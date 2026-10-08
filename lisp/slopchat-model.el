;;; slopchat-model.el --- One response, no agent loop -*- lexical-binding: t -*-
(require 'slopchat-codex)
(defvar slopchat-model--connection nil)
(defconst slopchat-model-eval-tools
  [(:type "function" :name "eval"
    :description "Request evaluation of one Emacs Lisp expression by the Lisp agent."
    :inputSchema (:type "object" :properties (:expression (:type "string"))
                  :required ["expression"] :additionalProperties :false))])
(defun slopchat-model-response (connection directory instructions messages model &optional on-run pump)
  "Return Ouro content blocks for MESSAGES without executing requested tools.
App Server is interrupted at the first tool boundary. Each response uses a
fresh thread; continuation history is supplied explicitly by the Lisp agent."
  (let* ((thread (slopchat-codex-thread
                  connection directory
                  (concat instructions "\nYou are a model adapter for an external Lisp agent.\n"
                          "Continue the supplied conversation; its tool_result blocks are actual host results.\n"
                          "Request eval when needed. Do not implement an internal tool loop.\n")
                  slopchat-model-eval-tools model))
         (run (slopchat-codex-run connection thread
                                     (concat "Conversation (Emacs Lisp data):\n" (prin1-to-string messages))
                                     nil nil nil 'model))
         content)
    (setf (slopchat-run-deferred run) t)
    (unwind-protect
        (progn
          (when on-run (funcall on-run run))
          (while (and (not (slopchat-run-done run)) (null (slopchat-run-requests run)))
            (if pump (funcall pump) (slopchat-codex-pump connection 0.05)))
          (when (and (slopchat-run-requests run) (slopchat-run-turn run))
            (slopchat-codex-rpc connection "turn/interrupt"
                                `(:threadId ,thread :turnId ,(slopchat-run-turn run)))
            (slopchat-codex--finish run))
          (dolist (text (nreverse (copy-sequence (slopchat-run-replies run))))
            (push `((type . "text") (text . ,text)) content))
          (dolist (request (nreverse (copy-sequence (slopchat-run-requests run))))
            (let ((params (plist-get request :params)))
              (unless (and (equal (plist-get params :tool) "eval")
                           (stringp (plist-get (plist-get params :arguments) :expression)))
                (error "Unexpected model tool request: %S" params))
              (push `((type . "tool_use") (id . ,(plist-get params :callId))
                      (name . "eval")
                      (input . ((expression . ,(plist-get (plist-get params :arguments) :expression)))))
                    content)))
          (when (and (null (slopchat-run-requests run)) (slopchat-run-error run))
            (error "%s" (slopchat-run-error run)))
          (nreverse content))
      (unless (slopchat-run-done run)
        ;; Cancellation ends the provider's loop before host evaluation begins.
        (when (slopchat-run-turn run)
          (ignore-errors (slopchat-codex-rpc connection "turn/interrupt"
                                           `(:threadId ,thread :turnId ,(slopchat-run-turn run)))))
        (slopchat-codex--finish run))
      (slopchat-codex-forget-thread connection thread))))
(defun slopchat-model-summary (connection thread prompt callback)
  "Start one tool-free summary response; retry policy belongs to memory."
  (slopchat-codex-run connection thread prompt
                     (lambda (&rest _) (error "Summary model cannot execute tools"))
                     nil callback 'compaction))
(defun slopchat-model-default (messages)
  (unless slopchat-model--connection
    (setq slopchat-model--connection (slopchat-codex-open)))
  (slopchat-model-response slopchat-model--connection default-directory
                          "You run inside GNU Emacs. Your sole tool is eval."
                          messages (and (boundp 'agent-model) agent-model)))
(defun slopchat-model-stop ()
  (when slopchat-model--connection
    (slopchat-codex-close slopchat-model--connection)
    (setq slopchat-model--connection nil)))
(add-hook 'kill-emacs-hook #'slopchat-model-stop)
(provide 'slopchat-model)
