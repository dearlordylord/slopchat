;;; slopchat-codex.el --- Multiplexed stdio app-server transport -*- lexical-binding: t -*-
(require 'cl-lib)
(require 'json)
(require 'subr-x)

(defvar slopchat-codex-command "codex")
(defvar slopchat-codex-timeout 600)
(cl-defstruct (slopchat-connection (:constructor slopchat--connection-create))
  process stderr (pending "") inbox (sequence 0) responses runs thread-config (callbacks (make-hash-table :test 'equal)))
(cl-defstruct (slopchat-run (:constructor slopchat--run-create))
  connection thread turn handler event done callback replies error deadline kind deferred requests)

(defun slopchat-codex--filter (connection text)
  (setf (slopchat-connection-pending connection)
        (concat (slopchat-connection-pending connection) text))
  (let ((pending (slopchat-connection-pending connection)))
    (while (string-match "\n" pending)
      (let ((line (substring pending 0 (match-beginning 0))))
        (setq pending (substring pending (match-end 0)))
        (unless (string-empty-p line)
          (setf (slopchat-connection-inbox connection)
                (nconc (slopchat-connection-inbox connection)
                       (list (json-parse-string line :object-type 'plist :false-object :false)))))))
    (setf (slopchat-connection-pending connection) pending)))
(defun slopchat-codex-send (connection message)
  (unless (process-live-p (slopchat-connection-process connection))
    (error "Codex app-server is not running"))
  (process-send-string (slopchat-connection-process connection)
                       (concat (json-serialize message) "\n")))
(defun slopchat-codex-async (connection method params &optional callback)
  "Send an RPC whose eventual response has one registered consumer."
  (let ((id (cl-incf (slopchat-connection-sequence connection))))
    (puthash id (or callback #'ignore) (slopchat-connection-callbacks connection))
    (slopchat-codex-send connection `(:id ,id :method ,method :params ,params))))
(defun slopchat-codex-forget-thread (connection thread)
  (when (process-live-p (slopchat-connection-process connection))
    (slopchat-codex-async connection "thread/unsubscribe" `(:threadId ,thread))))
(defun slopchat-codex--finish (run &optional error)
  (unless (slopchat-run-done run)
    (setf (slopchat-run-done run) t (slopchat-run-error run) error)
    (remhash (slopchat-run-thread run)
             (slopchat-connection-runs (slopchat-run-connection run)))
    (when (eq (slopchat-run-kind run) 'turn)
      (slopchat-codex-forget-thread (slopchat-run-connection run) (slopchat-run-thread run)))
    (when (slopchat-run-callback run) (funcall (slopchat-run-callback run) run))))
(defun slopchat-codex--dispatch (connection message)
  (let* ((method (plist-get message :method)) (params (plist-get message :params))
         (run (gethash (plist-get params :threadId) (slopchat-connection-runs connection))))
    (cond
     ((not method)
      ;; Keep every response, including replies to a different outstanding RPC.
      (let* ((id (plist-get message :id))
             (callback (gethash id (slopchat-connection-callbacks connection))))
        (if callback
            (progn (remhash id (slopchat-connection-callbacks connection)) (funcall callback message))
          (puthash id message (slopchat-connection-responses connection)))))
     ((and (plist-member message :id) run (slopchat-run-deferred run)
           (equal method "item/tool/call"))
      ;; Return the request to the caller. No eval and no tool result here.
      (push message (slopchat-run-requests run)))
     ((plist-member message :id)
      (let ((success t) text)
        (condition-case err
            (setq text
                  (if (and (equal method "item/tool/call") run (slopchat-run-handler run))
                      (funcall (slopchat-run-handler run) (plist-get params :tool)
                               (plist-get params :arguments))
                    (error "Unsupported or unauthorized client request: %s" method)))
          (error (setq success :false text (error-message-string err))))
        (if (equal method "item/tool/call")
            (slopchat-codex-send
             connection `(:id ,(plist-get message :id)
                           :result (:success ,success
                                    :contentItems [(:type "inputText" :text ,text)])))
          (slopchat-codex-send
           connection `(:id ,(plist-get message :id)
                         :error (:code -32601 :message ,text))))))
     (run
      (when (slopchat-run-event run) (funcall (slopchat-run-event run) method params))
      (cond
       ((equal method "item/completed")
        (let ((item (plist-get params :item)))
          (when (equal (plist-get item :type) "agentMessage")
            (push (plist-get item :text) (slopchat-run-replies run)))))
       ((equal method "turn/completed")
        (let ((turn (plist-get params :turn)))
          (when (or (null (slopchat-run-turn run))
                    (equal (slopchat-run-turn run) (plist-get turn :id)))
            (slopchat-codex--finish
             run (unless (equal (plist-get turn :status) "completed")
                   (format "Codex turn %s: %S" (plist-get turn :status) (plist-get turn :error))))))))))))
(defun slopchat-codex-pump (connection &optional wait)
  "Dispatch replies for all runs. WAIT lets Emacs service timers and stdin."
  (unless (process-live-p (slopchat-connection-process connection))
    (let (runs)
      (maphash (lambda (_ run) (push run runs)) (slopchat-connection-runs connection))
      (dolist (run runs) (slopchat-codex--finish run "Codex app-server exited")))
    (error "Codex app-server exited; inspect its stderr buffer"))
  (when wait (accept-process-output (slopchat-connection-process connection) wait))
  (while (slopchat-connection-inbox connection)
    (slopchat-codex--dispatch connection (pop (slopchat-connection-inbox connection))))
  (let (expired)
    (maphash (lambda (_ run)
               (when (> (float-time) (slopchat-run-deadline run)) (push run expired)))
             (slopchat-connection-runs connection))
    (dolist (run expired)
      (ignore-errors
        (slopchat-codex-async connection "turn/interrupt"
                               `(:threadId ,(slopchat-run-thread run) :turnId ,(slopchat-run-turn run))))
      (slopchat-codex--finish run "Codex turn timed out"))))
(defun slopchat-codex-rpc (connection method params)
  (let ((id (cl-incf (slopchat-connection-sequence connection)))
        (deadline (+ (float-time) slopchat-codex-timeout)) response)
    (slopchat-codex-send connection `(:id ,id :method ,method :params ,params))
    (while (not (setq response (gethash id (slopchat-connection-responses connection))))
      (when (> (float-time) deadline) (error "Codex RPC timed out: %s" method))
      (slopchat-codex-pump connection 0.05))
    (remhash id (slopchat-connection-responses connection))
    (when (plist-get response :error)
      (error "Codex %s: %s" method (plist-get (plist-get response :error) :message)))
    (plist-get response :result)))
(defun slopchat-codex-open ()
  "Start an owned app-server using existing ChatGPT authentication."
  (let* ((connection (slopchat--connection-create
                      :responses (make-hash-table :test 'equal)
                      :runs (make-hash-table :test 'equal)))
         (stderr (generate-new-buffer " *slopchat-codex-stderr*"))
         (overrides '("forced_login_method=\"chatgpt\""
                      "memories.use_memories=false" "memories.generate_memories=false"
                      "features.shell_tool=false" "features.multi_agent=false"
                      "features.multi_agent_v2=false" "features.apps=false"
                      "features.plugins=false" "features.remote_plugin=false"
                      "features.hooks=false" "features.browser_use=false"
                      "features.browser_use_external=false" "features.computer_use=false"
                      "features.image_generation=false" "features.sleep_tool=false"
                      "web_search=\"disabled\"" "tools.view_image=false"
                      "project_doc_max_bytes=0")))
    (setf (slopchat-connection-stderr connection) stderr
          (slopchat-connection-process connection)
          (make-process :name "slopchat-codex" :connection-type 'pipe :coding 'utf-8-unix
                        :command (append (list slopchat-codex-command "app-server" "--listen" "stdio://")
                                         (cl-mapcan (lambda (value) (list "-c" value)) overrides))
                        :filter (lambda (_process text) (slopchat-codex--filter connection text))
                        :stderr stderr :noquery t))
    (condition-case err
        (progn
          (slopchat-codex-rpc connection "initialize"
                               '(:clientInfo (:name "slopchat" :version "0.1.0")
                                 :capabilities (:experimentalApi t)))
          (slopchat-codex-send connection '(:method "initialized" :params ()))
          (unless (equal (plist-get
                          (plist-get (slopchat-codex-rpc connection "account/read" '()) :account)
                          :type) "chatgpt")
            (error "SlopChat requires the saved ChatGPT login, not an API key"))
          ;; Explicit MCP entries can exist even with plugins and apps disabled.
          ;; Disable them per thread, without changing the user's config file.
          (let* ((config (plist-get (slopchat-codex-rpc connection "config/read" '()) :config))
                 (servers (plist-get config :mcp_servers)) (thread-config nil))
            (while servers
              (let ((name (substring (symbol-name (pop servers)) 1)))
                (pop servers)
                (setq thread-config
                      (plist-put thread-config (intern (concat ":mcp_servers." name ".enabled")) :false))))
            (setf (slopchat-connection-thread-config connection) thread-config))
          connection)
      (error (slopchat-codex-close connection) (signal (car err) (cdr err))))))
(defun slopchat-codex-close (connection)
  (when (process-live-p (slopchat-connection-process connection))
    (process-send-eof (slopchat-connection-process connection))
    (accept-process-output (slopchat-connection-process connection) 0.2)
    (when (process-live-p (slopchat-connection-process connection))
      (delete-process (slopchat-connection-process connection))))
  (let (runs)
    (maphash (lambda (_ run) (push run runs)) (slopchat-connection-runs connection))
    (dolist (run runs) (slopchat-codex--finish run "Connection closed"))))
(defun slopchat-codex-thread (connection directory instructions tools &optional model)
  "Create a fresh ephemeral thread with stable instructions and tool definitions."
  (let ((params `(:cwd ,(expand-file-name directory) :modelProvider "openai"
                 :ephemeral t :approvalPolicy "never"
                 :sandbox ,(if (> (length tools) 0) "danger-full-access" "read-only")
                 :baseInstructions ,instructions :dynamicTools ,tools
                 :config ,(or (slopchat-connection-thread-config connection) (make-hash-table)))))
    (when model (setq params (plist-put params :model model)))
    (plist-get (plist-get (slopchat-codex-rpc connection "thread/start" params) :thread) :id)))
(defun slopchat-codex-run (connection thread prompt handler event callback &optional kind)
  "Start a turn; completions and tools are delivered by the shared dispatcher."
  (let ((run (slopchat--run-create
              :connection connection :thread thread :handler handler :event event
              :callback callback :kind kind :deadline (+ (float-time) slopchat-codex-timeout))))
    (when (gethash thread (slopchat-connection-runs connection)) (error "Thread already active"))
    (puthash thread run (slopchat-connection-runs connection))
    (condition-case err
        (slopchat-codex-async
         connection "turn/start"
         `(:threadId ,thread :input [(:type "text" :text ,prompt)])
         (lambda (response)
           (if (plist-get response :error)
               (slopchat-codex--finish run (plist-get (plist-get response :error) :message))
             (setf (slopchat-run-turn run)
                   (plist-get (plist-get (plist-get response :result) :turn) :id)))))
      (error (slopchat-codex--finish run (error-message-string err))))
    run))
(defun slopchat-codex-result (run)
  (mapconcat #'identity (nreverse (copy-sequence (slopchat-run-replies run))) "\n"))
(defun slopchat-codex-steer (run text)
  (slopchat-codex-rpc
   (slopchat-run-connection run) "turn/steer"
   `(:threadId ,(slopchat-run-thread run) :expectedTurnId ,(slopchat-run-turn run)
     :input [(:type "text" :text ,text)])))

(provide 'slopchat-codex)
;;; slopchat-codex.el ends here
