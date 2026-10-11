;;; slopchat-codex.el --- Multiplexed stdio app-server transport -*- lexical-binding: t -*-
(require 'cl-lib)
(require 'json)
(require 'subr-x)
(require 'slopchat-context)
(defvar slopchat-codex-observation-route nil)

(defvar slopchat-codex-request-observer nil
  "Optional observer of locally prepared RPC payloads before submission.")
(defvar slopchat-codex-command "codex")
(defvar slopchat-codex-timeout 600)
(cl-defstruct (slopchat-connection (:constructor slopchat--connection-create))
  process stderr (pending "") inbox (sequence 0) responses runs thread-config (callbacks (make-hash-table :test 'equal)))
(cl-defstruct (slopchat-run (:constructor slopchat--run-create))
  connection thread turn handler event done callback replies error deadline kind deferred requests)

;; Session metadata is external to transport structs to preserve live identities.
(defvar slopchat-codex--context-metadata (make-hash-table :test #'eq :weakness 'key))
(defun slopchat-connection-observations (connection)
  (or (gethash connection slopchat-codex--context-metadata)
      (puthash connection (make-hash-table :test #'equal) slopchat-codex--context-metadata)))
(defun slopchat-run-context-store (run)
  (plist-get (gethash run slopchat-codex--context-metadata) :store))
(defun slopchat-run-context-id (run)
  (plist-get (gethash run slopchat-codex--context-metadata) :id))
(gv-define-setter slopchat-run-context-store (value run)
  `(puthash ,run (plist-put (gethash ,run slopchat-codex--context-metadata) :store ,value) slopchat-codex--context-metadata))
(gv-define-setter slopchat-run-context-id (value run)
  `(puthash ,run (plist-put (gethash ,run slopchat-codex--context-metadata) :id ,value) slopchat-codex--context-metadata))

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
    (condition-case err
        (progn
          (when slopchat-codex-request-observer
            (funcall slopchat-codex-request-observer method params))
          ;; Dispatch may remove the run while process-send-string is yielding.
          (let ((run (and (equal method "turn/start")
                          (gethash (plist-get params :threadId) (slopchat-connection-runs connection)))))
            (slopchat-codex-send connection `(:id ,id :method ,method :params ,params))
            (when run (slopchat-codex--observe run (list :kind 'submission :state 'sent :sent-at (float-time))))))
      (error
       (remhash id (slopchat-connection-callbacks connection))
       (signal (car err) (cdr err))))))
(defun slopchat-codex-forget-thread (connection thread)
  (when (process-live-p (slopchat-connection-process connection))
    (slopchat-codex-async connection "thread/unsubscribe" `(:threadId ,thread))))
(defun slopchat-codex--observe (run event)
  (when (slopchat-run-context-store run)
    (slopchat-context-event (slopchat-run-context-store run) (slopchat-run-context-id run) event))
  (when-let ((emit (plist-get (gethash run slopchat-codex--context-metadata) :emit)))
    (funcall emit event)))
(defun slopchat-codex--retire-memory-route (route)
  (when-let ((emit (plist-get route :emit))) (funcall emit '(:kind retired))))
(defun slopchat-codex--prune-observations (connection)
  "Bound late routes even when no usage notification arrives."
  (let ((routes (slopchat-connection-observations connection))
        (now (float-time)))
    (maphash (lambda (key route)
               (when (<= (plist-get route :expires) now)
                 (slopchat-codex--retire-memory-route route) (remhash key routes))) routes)
    (while (> (hash-table-count routes) 100)
      (let (oldest deadline)
        (maphash (lambda (key route)
                   (when (or (null deadline) (< (plist-get route :expires) deadline))
                     (setq oldest key deadline (plist-get route :expires)))) routes)
        (slopchat-codex--retire-memory-route (gethash oldest routes))
        (remhash oldest routes)))))
(defun slopchat-codex--finish (run &optional error)
  (unless (slopchat-run-done run)
    (setf (slopchat-run-done run) t (slopchat-run-error run) error)
    (let ((metadata (gethash run slopchat-codex--context-metadata)))
      (when (or (slopchat-run-context-id run) (plist-get metadata :emit))
        (slopchat-codex--retire-memory-route
         (gethash (list (slopchat-run-thread run) (slopchat-run-turn run))
                  (slopchat-connection-observations (slopchat-run-connection run))))
        (puthash (list (slopchat-run-thread run) (slopchat-run-turn run))
                 (append (list :store (slopchat-run-context-store run)
                               :id (slopchat-run-context-id run) :turn (slopchat-run-turn run)
                               :expires (+ (float-time) 30)) metadata)
                 (slopchat-connection-observations (slopchat-run-connection run)))))
    (slopchat-codex--prune-observations (slopchat-run-connection run))
    (remhash (slopchat-run-thread run)
             (slopchat-connection-runs (slopchat-run-connection run)))
    (when (eq (slopchat-run-kind run) 'turn)
      (slopchat-codex-forget-thread (slopchat-run-connection run) (slopchat-run-thread run)))
    (when (slopchat-run-callback run) (funcall (slopchat-run-callback run) run))))
(defun slopchat-codex--plist-p (value)
  "Recognize finite proper property lists before reading telemetry."
  (and (proper-list-p value) (zerop (% (length value) 2))
       (cl-loop for (key _value) on value by #'cddr always (keywordp key))))
(defun slopchat-codex--normalize-usage (usage)
  "Map explicitly reported nonnegative counters; missing values stay absent."
  (let ((usage (if (slopchat-codex--plist-p usage) usage nil)) result)
    (dolist (scope '(:last :total))
      (let ((reported (plist-get usage scope)) counters)
        (unless (slopchat-codex--plist-p reported) (setq reported nil))
        (dolist (mapping '((:inputTokens . :input) (:cachedInputTokens . :cached-input)
                           (:outputTokens . :output) (:reasoningOutputTokens . :reasoning-output)
                           (:totalTokens . :total) (:cacheWriteInputTokens . :cache-write-input)))
          (let ((value (plist-get reported (car mapping))))
            (when (and (plist-member reported (car mapping)) (natnump value))
              (setq counters (plist-put counters (cdr mapping) value)))))
        (when (and (natnump (plist-get counters :reasoning-output))
                   (natnump (plist-get counters :output))
                   (> (plist-get counters :reasoning-output) (plist-get counters :output)))
          (setq counters nil))
        (when counters (setq result (plist-put result scope counters)))))
    (let ((limit (plist-get usage :modelContextWindow)))
      (when (and (integerp limit) (> limit 0))
        (setq result (plist-put result :context-limit limit))))
    result))

(defun slopchat-codex--usage (connection run params)
  "Retain reported counters without deriving unvalidated percentages."
  (let* ((routes (slopchat-connection-observations connection))
         (now (float-time)))
    (slopchat-codex--prune-observations connection)
    (let* ((route (gethash (list (plist-get params :threadId) (plist-get params :turnId)) routes))
           (run (if (and run (equal (slopchat-run-turn run) (plist-get params :turnId))) run nil))
           (store (if run (slopchat-run-context-store run) (plist-get route :store)))
           (id (if run (slopchat-run-context-id run) (plist-get route :id)))
           (turn (if run (slopchat-run-turn run) (plist-get route :turn))))
      (let* ((metadata (if run (gethash run slopchat-codex--context-metadata) route))
             (emit (plist-get metadata :emit)))
        (when (and emit turn (equal turn (plist-get params :turnId)))
          (let ((metrics (slopchat-codex--normalize-usage (plist-get params :tokenUsage))))
            (funcall emit (list :kind 'usage :source 'codex :received-at now
                                :scope 'cumulative :stream-id (plist-get params :threadId)
                                :reported (plist-get params :tokenUsage) :metrics metrics
                                :counters (plist-get metrics :total))))))
      (when (and store id turn (equal turn (plist-get params :turnId))
                 (not (cl-some
                       (lambda (event)
                         (and (eq (plist-get event :kind) 'usage)
                              (equal (plist-get event :reported) (plist-get params :tokenUsage))))
                       (plist-get (slopchat-context-get store id) :events))))
        (slopchat-context-event store id
                               (list :kind 'usage :source 'codex :received-at now
                                     :reported (plist-get params :tokenUsage)
                                     :metrics (slopchat-codex--normalize-usage
                                               (plist-get params :tokenUsage))))))))

(defun slopchat-codex--dispatch (connection message)
  (let* ((method (plist-get message :method)) (params (plist-get message :params))
         (run (gethash (plist-get params :threadId) (slopchat-connection-runs connection))))
    (when (equal method "thread/tokenUsage/updated")
      (slopchat-codex--usage connection run params))
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
  (slopchat-codex--prune-observations connection)
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
    (when slopchat-codex-request-observer
      (funcall slopchat-codex-request-observer method params))
    (slopchat-codex-send connection `(:id ,id :method ,method :params ,params))
    (while (not (setq response (gethash id (slopchat-connection-responses connection))))
      (when (> (float-time) deadline) (error "Codex RPC timed out: %s" method))
      (let ((slopchat-codex-request-observer nil)) (slopchat-codex-pump connection 0.05)))
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
    (dolist (run runs) (slopchat-codex--finish run "Connection closed")))
  (maphash (lambda (_ route) (slopchat-codex--retire-memory-route route))
           (slopchat-connection-observations connection))
  (clrhash (slopchat-connection-observations connection)))
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
    (when slopchat-codex-observation-route
      (puthash run (append slopchat-codex-observation-route (gethash run slopchat-codex--context-metadata)) slopchat-codex--context-metadata))
    (puthash thread run (slopchat-connection-runs connection))
    (condition-case err
        (slopchat-codex-async
         connection "turn/start"
         `(:threadId ,thread :input [(:type "text" :text ,prompt)])
         (lambda (response)
           (slopchat-codex--observe run
             (list :kind 'submission :state (if (plist-get response :error) 'rejected 'acknowledged)
                   :turn-id (plist-get (plist-get (plist-get response :result) :turn) :id)))
           (if (plist-get response :error)
               (slopchat-codex--finish run (plist-get (plist-get response :error) :message))
             (setf (slopchat-run-turn run)
                   (plist-get (plist-get (plist-get response :result) :turn) :id)))))
      (error (slopchat-codex--finish run (error-message-string err))))
    run))
(defun slopchat-codex-result (run)
  (mapconcat #'identity (nreverse (copy-sequence (slopchat-run-replies run))) "\n"))
(defun slopchat-codex-steer (run text)
  (let ((params `(:threadId ,(slopchat-run-thread run)
                  :expectedTurnId ,(slopchat-run-turn run)
                  :input [(:type "text" :text ,text)]))
        (store (slopchat-run-context-store run))
        (id (slopchat-run-context-id run)))
    (when store
      (slopchat-context-event store id (list :kind 'steer :state 'prepared :params params)))
    (condition-case err
        (prog1 (slopchat-codex-rpc (slopchat-run-connection run) "turn/steer" params)
          (when store
            (slopchat-context-event store id '(:kind steer :state acknowledged))))
      (error
       (when store
         (slopchat-context-event store id '(:kind steer :state failed)))
       (signal (car err) (cdr err))))))

(provide 'slopchat-codex)
;;; slopchat-codex.el ends here
