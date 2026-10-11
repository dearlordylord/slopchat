;;; slopchat-memory-backend.el --- Codex adapter for standalone memory -*- lexical-binding: t -*-
(require 'slopchat-memory-load)
(require 'unii-memory)
(require 'slopchat-model)
(require 'slopchat-cache-candidate)
(defvar slopchat-summary-model)
(declare-function slopchat--connection "slopchat" (chat))
(declare-function slopchat--provider-instructions "slopchat" ())
(declare-function slopchat-chat-directory "slopchat" (chat))
(declare-function slopchat-chat-transport "slopchat" (chat))
(defvar slopchat-summary-function nil
  "Legacy injected summary backend: (CHAT NODE PROMPT CONTEXT DONE).")

(defun slopchat-memory-backend (chat)
  "Build an adapter owning provider conversations, without exposing CHAT to memory."
  (let ((jobs (make-hash-table :test #'equal)))
    (list
     :late-usage t
     :start
     (lambda (request emit done)
       (if slopchat-summary-function
           (progn
             (funcall slopchat-summary-function chat (plist-get request :node)
                      (plist-get request :prompt) (plist-get request :context)
                      (lambda (text error)
                        (funcall done (if error (list :error (list :kind (if (equal error "Summary model cannot execute tools") 'forbidden-tool 'backend)
                                                                         :message error)) (list :text text)))
                        (funcall emit '(:kind retired))))
             nil)
         (let* ((id (plist-get request :job-id))
                (job (or (gethash id jobs) (puthash id (list :thread nil :provider-request nil) jobs)))
                (connection (slopchat--connection chat))
                (slopchat-codex-observation-route (list :emit emit))
                (slopchat-codex-request-observer
                 (lambda (method params)
                   (cond
                    ((member method '("thread/start" "thread/fork"))
                     (setf (plist-get job :provider-request) (list :method method :params (unii-memory-context-copy params))))
                    ((equal method "turn/start")
                     (funcall emit
                              (list :kind 'submission :state 'prepared :prepared-at (float-time)
                                    :payload (list (plist-get job :provider-request) (list :method method :params params))
                                    :provenance (list :thread (plist-get job :thread) :model slopchat-summary-model
                                                      :cache-route (plist-get (plist-get (plist-get job :provider-request) :anchorMetadata) :route)
                                                      :cache-anchor (plist-get (plist-get (plist-get job :provider-request) :anchorMetadata) :anchorId)
                                                      :cache-runtime (plist-get (plist-get (plist-get job :provider-request) :anchorMetadata) :runtimeVersion)
                                                      :prior-turns (plist-get request :prior-turns)))))))))
           (unless (plist-get job :thread)
             (condition-case err
                 (setf (plist-get job :thread)
                       (slopchat-cache-summary-thread connection (slopchat-chat-directory chat)
                                                      (slopchat-model-instructions (slopchat--provider-instructions))
                                                      slopchat-model-eval-tools slopchat-summary-model))
               (error
                (when (plist-get job :provider-request)
                  (funcall emit (list :kind 'submission :state 'prepared
                                      :payload (list (plist-get job :provider-request))
                                      :provenance (list :model slopchat-summary-model))))
                (funcall emit '(:kind retired))
                (signal (car err) (cdr err))))
             (when slopchat-cache-thread-provenance
               (setf (plist-get job :provider-request)
                     (plist-put (plist-get job :provider-request) :anchorMetadata
                                (unii-memory-context-copy slopchat-cache-thread-provenance)))))
           (let ((run (slopchat-model-summary
                       connection (plist-get job :thread) (plist-get request :prompt)
                       (lambda (run)
                         (let ((error (slopchat-run-error run)))
                           (funcall done
                                    (if error
                                        (list :error (list :kind (if (equal error "Summary model cannot execute tools") 'forbidden-tool 'backend)
                                                           :message error))
                                      (list :text (slopchat-codex-result run)))))))))
             (lambda ()
               (unless (slopchat-run-done run)
                 (when (slopchat-run-turn run)
                   (ignore-errors (slopchat-codex-rpc connection "turn/interrupt"
                                                    (list :threadId (slopchat-run-thread run) :turnId (slopchat-run-turn run)))))
                 (slopchat-codex--finish run "Memory closed")))))))
     :release
     (lambda (id)
       (let ((job (gethash id jobs)))
         (remhash id jobs)
         (when (and job (plist-get job :thread) (slopchat-chat-transport chat))
           (slopchat-codex-forget-thread (slopchat-chat-transport chat) (plist-get job :thread))))))))
(provide 'slopchat-memory-backend)
