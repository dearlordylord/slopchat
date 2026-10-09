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
      :stream ,(or (slopchat-chat-stream chat) :null)
      :working ,(if (slopchat-chat-run chat) t :false)
      :summaryActive ,(slopchat-chat-active chat)
      :summaryFailed ,(length (slopchat-chat-failed chat))
      :contextBytes ,(slopchat-view-size chat view)
      :viewTotal ,(length view) :offset ,offset :nodes ,(vconcat (nreverse nodes)))))

(defun slopchat-ui-models (chat)
  "Return a bounded account model catalog and current selection."
  (let (cursor models (pages 0))
    (while (progn
             (let ((page (slopchat-codex-rpc
                          (slopchat--connection chat) "model/list"
                          (append '(:limit 100 :includeHidden :false)
                                  (when cursor (list :cursor cursor))))))
               (setq models (append models (append (plist-get page :data) nil))
                     cursor (let ((next (plist-get page :nextCursor)))
                              (cond ((or (null next) (eq next :null)) nil)
                                    ((and (stringp next) (> (length next) 0)) next)
                                    (t (error "Invalid model catalog cursor"))))))
             (and cursor (< (cl-incf pages) 10))))
    (when cursor (error "Model catalog exceeds page limit"))
    `(:selected ,(or slopchat-turn-model :null) :models ,(vconcat models))))
(defun slopchat-ui-select-model (chat model)
  "Validate selection before changing the model for subsequent responses."
  (when (eq model :null) (setq model nil))
  (unless (or (null model) (and (stringp model) (not (string-empty-p model))))
    (error "model must be a nonempty string or null"))
  (when model
    (unless (cl-find model (append (plist-get (slopchat-ui-models chat) :models) nil)
                     :key (lambda (entry) (plist-get entry :model)) :test #'equal)
      (error "Model is not advertised for this account")))
  (setq slopchat-turn-model model)
  `(:selected ,(or model :null)))

(defun slopchat-ui--request (original chat process line)
  (condition-case err
      (let* ((request (slopchat--json-read line)) (action (plist-get request :action)))
        (cond
         ((equal action "models") (slopchat-cli--reply process `(:status "data" :value ,(slopchat-ui-models chat))))
         ((equal action "model")
          (unless (plist-member request :model) (error "Missing model"))
          (slopchat-cli--reply process `(:status "data" :value ,(slopchat-ui-select-model chat (plist-get request :model)))))
         (t (if (member action '("history" "status"))
            (slopchat-cli--reply process
             `(:status "data" :value ,(if (equal action "history")
                                         (slopchat-ui-history chat request)
                                       (slopchat-ui-status chat request))))
          (funcall original chat process line)))))
    (error (slopchat-cli--reply process `(:status "error" :message ,(error-message-string err))))))

(unless (advice-member-p #'slopchat-ui--request 'slopchat-cli--request)
  (advice-add 'slopchat-cli--request :around #'slopchat-ui--request))
(provide 'slopchat-ui)
