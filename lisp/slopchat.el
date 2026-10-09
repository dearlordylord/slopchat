;;; slopchat.el --- One persistent chat, fresh model runs -*- lexical-binding: t -*-
(require 'slopchat-store)
(require 'slopchat-codex)
(require 'slopchat-prompt)
(require 'slopchat-model)
(require 'slopchat-process)
(load (expand-file-name "../boot.el" (file-name-directory load-file-name)) nil t)
(defvar slopchat-current-chat nil "Chat visible to the self-developed Lisp agent.")
(defvar slopchat--ouro-updates nil)
(defun zoom (id n &optional page)
  (slopchat--tool slopchat-current-chat "zoom" `(:id ,id :n ,n :page ,(or page 0))))
(defun date (id)
  (slopchat--tool slopchat-current-chat "date" `(:id ,id)))

(defvar slopchat-turn-model nil "Nil uses the user's configured Codex model.")
(defvar slopchat-summary-model nil "Nil selects an available Luna/mini model.")
(defvar slopchat-summary-concurrency 8)
(defvar slopchat-user-instructions "")
(defvar slopchat-summary-function nil
  "Optional asynchronous test backend: (CHAT KEY PROMPT CONTEXT DONE).
DONE receives (TEXT ERROR). Production uses Codex threads and automatic retries.")
(defvar slopchat-turn-function nil
  "Optional test backend: (CHAT PROMPT DONE). DONE receives (TEXT ERROR).")
(defvar slopchat--scheduling nil)
(defvar slopchat--open-chats nil)
(defvar slopchat-last-thread nil "Thread ID of the last user turn, for diagnostics.")
(cl-defstruct (slopchat-summary (:constructor slopchat--summary-create))
  key source context thread (attempts 0) shortest finished)
(cl-defstruct (slopchat-input (:constructor slopchat--input-create)) text first callback steer)

(defun slopchat--record-input-error (chat input error)
  "Make a failed accepted input visible even after its client disconnects."
  (let ((text (format "Turn failed (input %s): %s" (slopchat-input-first input) error)))
    (slopchat-log chat "work" text)
    (message "%s" text)))

(defun slopchat--instructions ()
  (concat slopchat-system-prompt "\n\n# User instructions\n" slopchat-user-instructions))
(defun slopchat--connection (chat)
  (unless (slopchat-chat-transport chat)
    (setf (slopchat-chat-transport chat) (slopchat-codex-open))
    (unless slopchat-summary-model
      (let* ((models (plist-get (slopchat-codex-rpc (slopchat-chat-transport chat)
                                                  "model/list" '(:limit 100)) :data))
             (model (cl-find-if
                     (lambda (model) (string-match-p "luna\\|mini\\|nano" (plist-get model :model)))
                     (append models nil))))
        (unless model (error "No cheap model advertised; set slopchat-summary-model explicitly"))
        (setq slopchat-summary-model (plist-get model :model)))))
  (slopchat-chat-transport chat))
(defun slopchat--prefix (_chat view end)
  "Keep only ranges before END, splitting a crossing parent into built children."
  (cl-labels ((visit (key)
                (let* ((range (slopchat-range key)) (first (car range)) (span (cdr range)))
                  (cond ((>= first end) nil)
                        ((<= (+ first span) end) (list key))
                        (t (let ((level (1- (car key))) (index (* 2 (cadr key))))
                             (append (visit (list level index))
                                     (visit (list level (1+ index))))))))))
    (cl-mapcan #'visit (copy-sequence view))))
(defun slopchat--context (chat key)
  (let* ((range (slopchat-range key))
         (end (if (= (car key) 0) (car range) (+ (car range) (cdr range))))
         (prefix (slopchat--prefix chat (slopchat-chat-comp-view chat)
                                   (min end (slopchat-chat-cursor chat)))))
    (slopchat-render chat prefix)))
(defun slopchat--compaction-task (_chat job)
  (let* ((key (slopchat-summary-key job)) (range (slopchat-range key))
         (first (car range)) (span (cdr range)))
    (concat (slopchat-summary-context job) "\n\n"
            (if (= span 1)
                (format "Compaction: compress message %d into one line of at most 512 bytes\n(about 70 words), the length of this ruler:\n" first)
              (format "Compaction: merge lines %d+%d and %d+%d, adjacent, into one line of at most\n512 bytes (about 70 words), the length of this ruler:\n"
                      first (/ span 2) (+ first (/ span 2)) (/ span 2)))
            (make-string 512 ?-) "\n"
            (if (= span 1) ""
              (format "<chat> may hold their messages, %d to %d, in more detail: take details\nof them from there too.\n" first (+ first span -1)))
            "<input>\n" (slopchat-summary-source job) "\n</input>")))
(defun slopchat--shortest (job text)
  (when (or (null (slopchat-summary-shortest job))
            (< (slopchat-bytes text) (slopchat-bytes (slopchat-summary-shortest job))))
    (setf (slopchat-summary-shortest job) text)))
(defun slopchat--summary-finish (chat job text error)
  (unless (slopchat-summary-finished job)
    (setf (slopchat-summary-finished job) t)
    (cl-decf (slopchat-chat-active chat))
    (when (and (slopchat-summary-thread job) (slopchat-chat-transport chat))
      (slopchat-codex-forget-thread (slopchat-chat-transport chat) (slopchat-summary-thread job)))
    (if error
        (progn
          (puthash (slopchat-summary-key job) 'failed (slopchat-chat-states chat))
          (push (slopchat-summary-key job) (slopchat-chat-failed chat))
          (message "SlopChat summary %S failed; retry on next message: %s"
                   (slopchat-summary-key job) error))
      (slopchat-build chat (slopchat-summary-key job) text))))
(defun slopchat--summary-reply (chat job text error)
  (unless (slopchat-summary-finished job)
    (if error (slopchat--summary-finish chat job nil error)
      (setq text (string-trim text))
      (if (string-empty-p text) (slopchat--summary-finish chat job nil "Empty summary")
        (slopchat--shortest job text)
        (if (and (> (slopchat-bytes text) 512) (< (slopchat-summary-attempts job) 5))
            (slopchat--summary-attempt
             chat job (format "Too long: your line is %d bytes, over the 512-byte limit. Write\nthe whole line again for the same <input>, cutting just enough of the\nleast valuable items to fit before this cut:\n%s| ← LIMIT"
                              (slopchat-bytes text) (car (slopchat-split text 512))))
          (slopchat--summary-finish chat job (slopchat-summary-shortest job) nil))))))
(defun slopchat--summary-attempt (chat job prompt)
  (cl-incf (slopchat-summary-attempts job))
  (if slopchat-summary-function
      (funcall slopchat-summary-function chat (slopchat-summary-key job) prompt
               (slopchat-summary-context job)
               (lambda (text error) (slopchat--summary-reply chat job text error)))
    (slopchat-model-summary
     (slopchat--connection chat) (slopchat-summary-thread job) prompt
     (lambda (run) (slopchat--summary-reply chat job (slopchat-codex-result run)
                                           (slopchat-run-error run))))))

(defun slopchat-schedule (chat)
  "Start ready queued nodes, never scan the tree for work."
  (unless slopchat--scheduling
    (let ((slopchat--scheduling t) key)
      (while (and (< (slopchat-chat-active chat) (min 8 (max 1 slopchat-summary-concurrency)))
                  (setq key (slopchat-dequeue (slopchat-chat-jobs chat))))
        (when (eq (gethash key (slopchat-chat-states chat)) 'queued)
          (puthash key 'active (slopchat-chat-states chat))
          (cl-incf (slopchat-chat-active chat))
          (let ((job (slopchat--summary-create :key key :source (slopchat-source chat key)
                                              :context (slopchat--context chat key))))
            (condition-case err
                (progn
                  (unless slopchat-summary-function
                    (setf (slopchat-summary-thread job)
                          (slopchat-codex-thread (slopchat--connection chat)
                                                (slopchat-chat-directory chat)
                                                (slopchat--instructions) [] slopchat-summary-model)))
                  (slopchat--summary-attempt chat job (slopchat--compaction-task chat job)))
              (error (slopchat--summary-finish chat job nil (error-message-string err))))))))))
(defun slopchat-pump (chat &optional wait)
  (slopchat-schedule chat)
  (when (slopchat-chat-transport chat)
    (condition-case err
        (slopchat-codex-pump (slopchat-chat-transport chat) wait)
      (error
       (let ((connection (slopchat-chat-transport chat)))
         (unless (process-live-p (slopchat-connection-process connection))
           (setf (slopchat-chat-transport chat) nil)))
       (signal (car err) (cdr err)))))
  (slopchat-schedule chat)
  (let ((run (slopchat-chat-run chat)))
    (when (and (slopchat-run-p run) (slopchat-run-turn run) (not (slopchat-run-done run)))
      (while (and (slopchat-queue-head (slopchat-chat-queued-input chat))
                  (slopchat-input-steer (car (slopchat-queue-head (slopchat-chat-queued-input chat)))))
        (let ((input (slopchat-dequeue (slopchat-chat-queued-input chat))))
          (condition-case _err
              (progn (slopchat-codex-steer run (slopchat-input-text input))
                     (when (eq chat slopchat-current-chat)
                       (push (slopchat-input-text input) slopchat--ouro-updates))
                     (when (slopchat-input-callback input)
                       (funcall (slopchat-input-callback input) nil 'steered)))
            (error (setf (slopchat-input-steer input) nil)
                   (slopchat-queue-front (slopchat-chat-queued-input chat) input)))))))
  (when (and (slopchat-chat-failed chat) (= (slopchat-chat-active chat) 0)
             (null (slopchat-queue-head (slopchat-chat-jobs chat))))
    (while (and (slopchat-queue-head (slopchat-chat-queued-input chat))
                (< (slopchat-chat-cursor chat)
                   (slopchat-input-first (car (slopchat-queue-head (slopchat-chat-queued-input chat))))))
      (let ((input (slopchat-dequeue (slopchat-chat-queued-input chat))))
        (slopchat--record-input-error
         chat input "Prior summaries failed; your message is saved. Retry with a new message")
        (when (slopchat-input-callback input)
          (funcall (slopchat-input-callback input) nil
                   "Prior summaries failed; your message is saved. Retry with a new message")))))
  (when (and (null (slopchat-chat-run chat))
             (slopchat-queue-head (slopchat-chat-queued-input chat)))
    (let ((input (car (slopchat-queue-head (slopchat-chat-queued-input chat)))))
      (when (>= (slopchat-chat-cursor chat) (slopchat-input-first input))
        (slopchat-dequeue (slopchat-chat-queued-input chat))
        (slopchat--start-input chat input)))))

(defun slopchat--tool (chat tool args)
  (slopchat-log chat "tool" (json-serialize `(:name ,tool :input ,args)))
  (let* (failure (text (condition-case err
                  (pcase tool
                    ("emacs_eval" (prin1-to-string (eval (read (plist-get args :expression)) t)))
                    ("zoom" (json-serialize (slopchat-zoom chat (plist-get args :id)
                                                         (plist-get args :n) (plist-get args :page))))
                    ("date" (slopchat-date chat (plist-get args :id)))
                    (_ (error "Unknown tool: %s" tool)))
                (error (setq failure t) (concat "ERROR: " (error-message-string err))))))
    (setq text (slopchat-clip text))
    (slopchat-log chat "echo" text)
    (if failure (error "%s" text) text)))
(defun slopchat--start-input (chat input)
  (let* ((prefix (slopchat--prefix chat (slopchat-chat-view chat) (slopchat-input-first input)))
         (prompt (concat (slopchat-render chat prefix) "\n\n" (slopchat-input-text input))))
    (setf (slopchat-chat-run chat) 'starting)
    (condition-case err
        (if slopchat-turn-function
            (funcall slopchat-turn-function chat prompt
                     (lambda (text error)
                       (when text (slopchat-log chat "slopchat" text))
                       (when error (slopchat--record-input-error chat input error))
                       (setf (slopchat-chat-run chat) nil)
                       (when (slopchat-input-callback input)
                         (funcall (slopchat-input-callback input) text error))))
          (let* ((connection (slopchat--connection chat))
                 (slopchat-current-chat chat)
                 (slopchat--ouro-updates nil)
                 (agent-eval-function
                  (lambda (expression) (slopchat--tool chat "emacs_eval" `(:expression ,expression))))
                 (agent-model-function
                  (lambda (messages)
                    ;; Inputs received between calls become explicit model history.
                    (while (and (slopchat-queue-head (slopchat-chat-queued-input chat))
                                (slopchat-input-steer
                                 (car (slopchat-queue-head (slopchat-chat-queued-input chat)))))
                      (let ((update (slopchat-dequeue (slopchat-chat-queued-input chat))))
                        (push (slopchat-input-text update) slopchat--ouro-updates)
                        (when (slopchat-input-callback update)
                          (funcall (slopchat-input-callback update) nil 'steered))))
                    (setq messages (vconcat messages
                                            (mapcar (lambda (text) `(:role "user" :content ,text))
                                                    (reverse slopchat--ouro-updates))))
                    (unwind-protect
                        (slopchat-model-response
                         connection (slopchat-chat-directory chat)
                         (concat (slopchat--instructions)
                                 "\nYour only provider tool is eval. Memory is available as Lisp (zoom ID N PAGE) and (date ID).\n")
                         messages slopchat-turn-model
                         (lambda (run)
                           (setq slopchat-last-thread (slopchat-run-thread run))
                           (setf (slopchat-chat-run chat) run))
                         (lambda () (slopchat-pump chat 0.05)))
                      (setf (slopchat-chat-run chat) 'starting))))
                 (bootstrapping (null (slopchat-chat-agent chat)))
                 reply)
            ;; Bind the function cell per chat. The model's fset/defun writes
            ;; this cell; capture it before restoring the outer environment.
            (cl-letf (((symbol-function 'agent)
                       (or (slopchat-chat-agent chat) (symbol-function 'agent-bootstrap))))
              (unwind-protect
                  (setq reply (if (slopchat-chat-agent chat) (agent prompt) (agent-boot prompt)))
                (unless (eq (symbol-function 'agent) (symbol-function 'agent-bootstrap))
                  (setf (slopchat-chat-agent chat) (symbol-function 'agent)))))
            (unless (slopchat-chat-agent chat)
              (error "Ouro bootstrap did not create agent: %s" reply))
            ;; The original one-shot bootstrap prints its eval result.
            (when (and bootstrapping (stringp reply) (string-prefix-p "\"" reply))
              (condition-case nil
                  (let ((value (read reply))) (when (stringp value) (setq reply value)))
                (error nil)))
            (slopchat-log chat "slopchat" reply)
            (setf (slopchat-chat-run chat) nil)
            (when (slopchat-input-callback input)
              (funcall (slopchat-input-callback input) reply nil))))
      (error
       (setf (slopchat-chat-run chat) nil)
       (slopchat--record-input-error chat input (error-message-string err))
       (if (slopchat-input-callback input)
           (funcall (slopchat-input-callback input) nil (error-message-string err))
         (signal (car err) (cdr err)))))))
(defun slopchat-submit (chat text &optional callback on-accepted)
  "Log input once; steer a live turn or queue a fresh turn. Return its first ID.
CALLBACK receives (REPLY ERROR) when a newly started user turn completes."
  (let* ((first (slopchat-chat-count chat))
         (input (slopchat--input-create :text text :first first :callback callback
                                      :steer (and (slopchat-chat-run chat) t))))
    ;; Rendering for queued input is restricted to IDs before FIRST, even if its
    ;; own leaf is already built by the time its fresh turn starts.
    (slopchat-log chat "user" text)
    ;; Acceptance follows durable input logging, before any model work.
    (when on-accepted (funcall on-accepted first))
    (let ((run (slopchat-chat-run chat)))
      (if (and (slopchat-run-p run) (slopchat-run-turn run) (not (slopchat-run-done run)))
          (condition-case _err
              (progn (slopchat-codex-steer run text)
                     (when (eq chat slopchat-current-chat) (push text slopchat--ouro-updates))
                     (when callback (funcall callback nil 'steered)))
            (error (setf (slopchat-input-steer input) nil)
                   (slopchat-enqueue (slopchat-chat-queued-input chat) input)))
        (slopchat-enqueue (slopchat-chat-queued-input chat) input)))
    (slopchat-pump chat)
    first))
(defun slopchat-send (chat text)
  "Synchronous convenience wrapper for one user message."
  (when (slopchat-chat-run chat) (error "Use slopchat-submit to steer an active turn"))
  (let (done reply failure)
    (slopchat-submit chat text (lambda (text error) (setq done t reply text failure error)))
    (while (not done)
      (when (and (slopchat-chat-failed chat) (= (slopchat-chat-active chat) 0)
                 (slopchat-queue-head (slopchat-chat-queued-input chat)))
        ;; Fail before starting with incomplete context; keep the submitted input
        ;; in the durable log for the next message/restart.
        (setf (slopchat-chat-queued-input chat) (slopchat-queue-create))
        (error "Prior summaries failed; message is saved. Retry with a new message"))
      (slopchat-pump chat 0.05))
    (when failure (error "%s" failure)) reply))
(defun slopchat-drain (chat)
  "Finish queued background summaries before an orderly shutdown."
  (while (or (> (slopchat-chat-active chat) 0) (slopchat-queue-head (slopchat-chat-jobs chat)))
    (slopchat-pump chat 0.05))
  (when (slopchat-chat-failed chat) (error "Some summaries failed; raw messages are saved")))
(defun slopchat-shutdown (chat)
  "Close this chat without attempting to resume an interrupted model run."
  (setf (slopchat-chat-closed chat) t)
  (when (slopchat-chat-transport chat) (slopchat-codex-close (slopchat-chat-transport chat)))
  (slopchat-close chat)
  (setq slopchat--open-chats (delq chat slopchat--open-chats)))
(defun slopchat-start (directory)
  (let ((chat (slopchat-open directory)))
    (push chat slopchat--open-chats) chat))
(add-hook 'kill-emacs-hook
          (lambda () (dolist (chat (copy-sequence slopchat--open-chats)) (slopchat-shutdown chat))))

(provide 'slopchat)
;;; slopchat.el ends here
