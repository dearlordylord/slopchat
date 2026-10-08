;;; slopchat-ui.el --- Bounded read-only UI protocol -*- lexical-binding: t -*-
(require 'slopchat)

(defun slopchat-ui--limit (value default maximum)
  (unless (or (null value) (natnump value)) (error "Expected nonnegative integer"))
  (min maximum (max 1 (or value default))))

(defun slopchat-ui-history (chat request)
  "Read a bounded page; COUNT is the snapshot watermark for subsequent pages."
  (let* ((count (slopchat-chat-count chat))
         (before (plist-get request :before))
         (after (plist-get request :after))
         (limit (slopchat-ui--limit (plist-get request :limit) 40 100))
         (end (if before (progn (unless (natnump before) (error "Invalid before")) (min before count)) count))
         (start (if after (progn (unless (natnump after) (error "Invalid after")) (min after end)) (max 0 (- end limit))))
         (end (min end (+ start limit))) messages)
    (cl-loop for id from start below end do
             (let ((message (gethash id (slopchat-chat-messages chat))))
               (push message messages)))
    `(:count ,count :start ,start :end ,end :messages ,(vconcat (nreverse messages)))))

(defun slopchat-ui-status (chat request)
  "Bounded memory page and truthful server measurements, without journal writes."
  (let* ((offset (or (plist-get request :offset) 0))
         (limit (slopchat-ui--limit (plist-get request :limit) 40 100))
         (view (slopchat-chat-view chat)) nodes)
    (unless (natnump offset) (error "Invalid offset"))
    (cl-loop for key in (nthcdr (min offset (length view)) view)
             for index from 0 below limit do
             (let ((range (slopchat-range key)) (node (slopchat-node chat key)))
               (push `(:id ,(car range) :n ,(cdr range) :text ,(plist-get node :text)) nodes)))
    `(:count ,(slopchat-chat-count chat) :cursor ,(slopchat-chat-cursor chat)
      :working ,(if (slopchat-chat-run chat) t :false)
      :summaryActive ,(slopchat-chat-active chat)
      :summaryFailed ,(length (slopchat-chat-failed chat))
      :contextBytes ,(slopchat-view-size chat view)
      :viewTotal ,(length view) :offset ,offset :nodes ,(vconcat (nreverse nodes)))))

(defun slopchat-ui--request (original chat process line)
  (condition-case err
      (let* ((request (slopchat--json-read line)) (action (plist-get request :action)))
        (if (member action '("history" "status"))
            (slopchat-cli--reply process
             `(:status "data" :value ,(if (equal action "history")
                                         (slopchat-ui-history chat request)
                                       (slopchat-ui-status chat request))))
          (funcall original chat process line)))
    (error (slopchat-cli--reply process `(:status "error" :message ,(error-message-string err))))))

(unless (advice-member-p #'slopchat-ui--request 'slopchat-cli--request)
  (advice-add 'slopchat-cli--request :around #'slopchat-ui--request))
(provide 'slopchat-ui)
