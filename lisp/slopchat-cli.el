;;; slopchat-cli.el --- Local socket interface for headless use -*- lexical-binding: t -*-
(require 'slopchat)

(defvar slopchat--server nil)
(defvar slopchat--clients nil)
(defun slopchat-cli--client-sentinel (process _event)
  "Release disconnected clients instead of retaining every polling socket."
  (unless (process-live-p process)
    (setq slopchat--clients (delq process slopchat--clients))
    (process-put process 'pending nil)))
(defun slopchat-cli--reply (process value)
  (when (process-live-p process)
    (process-send-string process (concat (json-serialize value) "\n"))))
(defun slopchat-cli--request (chat process line)
  (condition-case err
      (let ((request (slopchat--json-read line)))
        (pcase (plist-get request :action)
          ("send"
           (unless (stringp (plist-get request :text)) (error "text must be a string"))
           (let ((ack (plist-get request :ack)) (ready nil) (completion nil))
             (let* ((deliver (lambda (reply error)
                              (slopchat-cli--reply process
                               (cond ((eq error 'steered) '(:status "steered"))
                                     (error `(:status "error" :message ,error))
                                     (t `(:status "reply" :text ,reply))))))
                    (_accepted-id (slopchat-submit chat (plist-get request :text)
                         (lambda (reply error)
                           (if ready (funcall deliver reply error)
                             (setq completion (list reply error))))
                         (when ack (lambda (id)
                           (slopchat-cli--reply process `(:status "accepted" :value ,id))))
                         (eq (plist-get request :queue) t))))

               (setq ready t)
               (when completion (apply deliver completion)))))
          ("note"
           (unless (stringp (plist-get request :text)) (error "text must be a string"))
           (let ((ids (slopchat-log chat "note" (plist-get request :text))))
             (slopchat-cli--reply process `(:status "data" :value ,(vconcat ids)))
             (slopchat-pump chat)))
          ("zoom"
           (slopchat-cli--reply process
                                `(:status "data" :value ,(slopchat-zoom chat (plist-get request :id)
                                                                       (plist-get request :n)
                                                                       (plist-get request :page)))))
          ("date"
           (slopchat-cli--reply process
                                `(:status "data" :value ,(slopchat-date chat (plist-get request :id)))))
          ("cancel" (slopchat-cli--reply process
            `(:status "data" :value ,(if (slopchat-cancel-round chat) t :false))))
          ("stop" (slopchat-cli--reply process '(:status "stopping"))
           (when (process-live-p slopchat--server) (delete-process slopchat--server)))
          (_ (error "Unknown action"))))
    (error (slopchat-cli--reply process `(:status "error" :message ,(error-message-string err))))))
(defun slopchat-serve (directory)
  "Serve newline-delimited JSON over DIRECTORY/session.sock, without a UI.
Run in batch mode. Stop through the local client or by terminating Emacs."
  (let* ((chat (slopchat-start directory))
         (socket (expand-file-name "session.sock" (slopchat-chat-directory chat))))
    (unwind-protect
        (progn
          ;; Exclusive chat ownership makes removing a prior dead socket safe.
          (when (file-exists-p socket) (delete-file socket))
          (setq slopchat--server
                (make-network-process
                 :name "slopchat-local" :family 'local :service socket :server t
                 :coding 'utf-8-unix :noquery t
                 :log (lambda (_server client _message)
                        (push client slopchat--clients)
                        (set-process-query-on-exit-flag client nil)
                        (set-process-sentinel client #'slopchat-cli--client-sentinel)
                        (set-process-filter
                         client (lambda (process text)
                                  (let ((pending (concat (or (process-get process 'pending) "") text)))
                                    (while (string-match "\n" pending)
                                      (let ((line (substring pending 0 (match-beginning 0))))
                                        (setq pending (substring pending (match-end 0)))
                                        (process-put process 'pending pending)
                                        (slopchat-cli--request chat process line)))
                                    (process-put process 'pending pending)))))))
          (set-file-modes socket #o600)
          (princ (format "SlopChat listening: %s\n" socket))
          (while (process-live-p slopchat--server)
            (accept-process-output nil 0.05)
            (condition-case err (slopchat-pump chat)
              (error (message "SlopChat: %s" (error-message-string err)))))
          (unless (slopchat-chat-run chat)
            (condition-case err (slopchat-drain chat)
              (error (message "%s" (error-message-string err))))))
      (dolist (client slopchat--clients) (when (process-live-p client) (delete-process client)))
      (setq slopchat--clients nil)
      (when (process-live-p slopchat--server) (delete-process slopchat--server))
      (when (file-exists-p socket) (delete-file socket))
      (slopchat-shutdown chat))))
(require 'slopchat-ui)
(provide 'slopchat-cli)
