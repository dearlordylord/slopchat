;;; slopchat-model.el --- One response, no agent loop -*- lexical-binding: t -*-
(require 'slopchat-codex)
(require 'slopchat-context)
(defvar slopchat-model-context-store nil)
(defvar slopchat-model-context-observer nil
  "Application observation sink; accepts prepared/event/finished records.")
(defvar slopchat-model-context-provenance nil)
(defvar slopchat-model--connection nil)
(defconst slopchat-model-eval-tools
  [(:type "function" :name "eval"
    :description "Request evaluation of one Emacs Lisp expression by the Lisp agent."
    :inputSchema (:type "object" :properties (:expression (:type "string"))
                  :required ["expression"] :additionalProperties :false))])
(defun slopchat-model-instructions (instructions)
  (concat instructions "\nYou are a model adapter for an external Lisp agent.\n"
                          "Continue the supplied conversation; its tool_result blocks are actual host results.\n"
                          "Request eval when needed. Do not implement an internal tool loop.\n"))
(defun slopchat-model-input (messages)
  (concat "Conversation (Emacs Lisp data):\n" (prin1-to-string messages)))
(defun slopchat-model-response (connection directory instructions messages model &optional on-run pump on-event)
  "Return Ouro content blocks for MESSAGES without executing requested tools.
App Server is interrupted at the first tool boundary. Each response uses a
fresh thread; continuation history is supplied explicitly by the Lisp agent."
  (let* ((snapshot nil)
         (requests nil)
         (outcome 'failed)
         (slopchat-codex-request-observer
          (when (or slopchat-model-context-store slopchat-model-context-observer)
            (lambda (method params)
              (when (member method '("thread/start" "turn/start"))
                (push (slopchat-context-copy (list :method method :params params)) requests)
                (when (equal method "turn/start")
                  (setq snapshot
                        (if slopchat-model-context-observer
                            (funcall slopchat-model-context-observer
                                     (list :kind 'prepared :payload (reverse requests) :provenance slopchat-model-context-provenance))
                          (slopchat-context-capture slopchat-model-context-store (reverse requests) slopchat-model-context-provenance)))
                  (if slopchat-model-context-observer
                      (funcall slopchat-model-context-observer
                               (list :kind 'event :id snapshot :event (list :kind 'submission :state 'prepared :prepared-at (float-time))))
                    (slopchat-context-event slopchat-model-context-store snapshot
                                            (list :kind 'submission :state 'prepared :prepared-at (float-time))))
                  (let ((prepared-run (gethash (plist-get params :threadId)
                                              (slopchat-connection-runs connection))))
                    (when prepared-run
                      (when slopchat-model-context-observer
                        (puthash prepared-run
                                 (plist-put (gethash prepared-run slopchat-codex--context-metadata) :emit
                                            (let ((observe slopchat-model-context-observer) (id snapshot))
                                              (lambda (event)
                                                (funcall observe (list :kind 'event :id id :event event)))))
                                 slopchat-codex--context-metadata))
                      (setf (slopchat-run-context-store prepared-run) slopchat-model-context-store
                            (slopchat-run-context-id prepared-run) snapshot))))))))
         (thread (condition-case err (slopchat-codex-thread
                  connection directory
                  (slopchat-model-instructions instructions)
                  slopchat-model-eval-tools model)
                   (error
                    ;; Preserve only requests actually prepared before rejection.
                    (when requests
                      (cond
                       (slopchat-model-context-observer
                        (let ((id (funcall slopchat-model-context-observer
                                           (list :kind 'prepared :payload (reverse requests) :provenance slopchat-model-context-provenance))))
                          (funcall slopchat-model-context-observer (list :kind 'finished :id id :outcome 'failed))))
                       (slopchat-model-context-store
                        (let ((id (slopchat-context-capture slopchat-model-context-store
                                    (reverse requests) slopchat-model-context-provenance)))
                          (slopchat-context-finish slopchat-model-context-store id 'failed)))))
                    (signal (car err) (cdr err)))))
         (run (slopchat-codex-run connection thread
                                     (slopchat-model-input messages)
                                     nil on-event nil 'model))
         content)
    (setf (slopchat-run-deferred run) t
          (slopchat-run-context-store run) slopchat-model-context-store
          (slopchat-run-context-id run) snapshot)
    (unwind-protect
        (progn
          (when on-run (funcall on-run run))
          (while (and (not (slopchat-run-done run)) (null (slopchat-run-requests run)))
            (let ((slopchat-codex-request-observer nil)) (if pump (funcall pump) (slopchat-codex-pump connection 0.05))))
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
          (setq outcome (if (slopchat-run-requests run) 'tool-boundary 'completed))
          (nreverse content))
      (unless (slopchat-run-done run)
        ;; Cancellation ends the provider's loop before host evaluation begins.
        (when (slopchat-run-turn run)
          (ignore-errors (slopchat-codex-rpc connection "turn/interrupt"
                                           `(:threadId ,thread :turnId ,(slopchat-run-turn run)))))
        (slopchat-codex--finish run))
      (when snapshot
        (let ((outcome (if (and (boundp 'slopchat--round-token)
                                slopchat--round-token (car slopchat--round-token)) 'cancelled outcome)))
          (if slopchat-model-context-observer
              (funcall slopchat-model-context-observer (list :kind 'finished :id snapshot :outcome outcome))
            (slopchat-context-finish slopchat-model-context-store snapshot outcome))))
      (slopchat-codex-forget-thread connection thread))))
(defun slopchat-model-summary (connection thread prompt callback)
  "Start one tool-free summary response; retry policy belongs to memory."
  (let (tool-requested)
    (slopchat-codex-run
     connection thread
     (slopchat-model-input (vector (list :role "user" :content prompt)))
     (lambda (tool &rest _)
       (setq tool-requested t)
       (let ((run (and (slopchat-connection-p connection)
                       (gethash thread (slopchat-connection-runs connection)))))
         (when run
           (slopchat-codex--observe run
                                  (list :kind 'summary-tool-rejection :state 'rejected
                                        :scope 'source-only :tool tool))))
       (error "Summary model cannot execute tools"))
     nil (lambda (run)
           ;; A provider can continue after the rejected request. Its denial
           ;; report is an inference failure, never a fact from the source.
           (when tool-requested
             (setf (slopchat-run-error run)
                   (or (slopchat-run-error run) "Summary model cannot execute tools")))
           (funcall callback run))
     'compaction)))
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
