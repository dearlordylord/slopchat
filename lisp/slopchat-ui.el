;;; slopchat-ui.el --- Bounded read-only UI protocol -*- lexical-binding: t -*-
(require 'slopchat)
(require 'pp)

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
         (end (min end (+ start limit))) messages (bytes 0))
    (cl-loop for id from start below end do
             (let* ((message (copy-sequence (gethash id (slopchat-chat-messages chat))))
                    (presentation (plist-get message :tool)))
               ;; Old journal records can contain unbounded presentation metadata.
               (when presentation
                 (setq message (plist-put message :tool
                                          (slopchat-bounded-presentation presentation id 1))))
               (let ((size (string-bytes (json-serialize message))))
                 (if (> (+ bytes size) 3000000)
                     (progn (setq end id) (cl-return))
                   (cl-incf bytes size)
                   (push message messages)))))
    `(:count ,count :start ,start :end ,end :messages ,(vconcat (nreverse messages)))))

(defun slopchat-ui--context-observation (entry)
  "Project the latest reported usage for this entry only."
  (let ((event (car (last (cl-remove-if-not
                         (lambda (e) (eq (plist-get e :kind) 'usage))
                         (plist-get entry :events))))))
    (if event
        (list :source (symbol-name (plist-get event :source))
              :receivedAt (plist-get event :received-at)
              :metrics (or (plist-get event :metrics) :null))
      :null)))

(defun slopchat-ui--token-estimate (entry)
  "Estimate captured sections only, not hidden provider context."
  (let (parts)
    (dolist (section '("instructions" "tools" "input"))
      (let ((value (slopchat-ui--context-section entry section)))
        (unless (eq value 'slopchat-context-field-unavailable)
          (let ((text (cond ((stringp value) value)
                            ((equal section "input") (or (slopchat-ui--context-input-text value) (prin1-to-string value)))
                            (t (prin1-to-string value)))))
            (setq parts (plist-put parts (intern (concat ":" section)) (ceiling (length text) 4)))))))
    (let* ((memory (plist-get (plist-get entry :provenance) :memory-text))
           (input (slopchat-ui--context-input-text (slopchat-ui--context-section entry "input")))
           (encoded (and (stringp memory) (substring (prin1-to-string memory) 1 -1))))
      ;; Split only captured text found in the actual serialized request.
      (when (and encoded input (with-temp-buffer (insert input) (goto-char (point-min)) (search-forward encoded nil t)))
        (let ((count (min (plist-get parts :input) (ceiling (length encoded) 4))))
          (setq parts (plist-put parts :memory count))
          (setq parts (plist-put parts :otherInput (- (plist-get parts :input) count))))))
    (when (and (plist-member parts :instructions) (plist-member parts :tools) (plist-member parts :input))
      (append (list :method "characters/4" :scope "captured-call" :total (+ (plist-get parts :instructions) (plist-get parts :tools) (plist-get parts :input))) parts))))

(defun slopchat-ui--calibrated-estimate (entry entries)
  "Calibrate captured text only against an earlier compatible explicit model."
  (let* ((raw (slopchat-ui--token-estimate entry))
         (config (plist-get (cl-find "thread/start" (plist-get entry :payload) :key (lambda (r) (plist-get r :method)) :test #'equal) :params))
         (older (cdr (cl-member (plist-get entry :id) entries :key (lambda (e) (plist-get e :id)) :test (function equal)))) baseline ratio)
    (when (and raw (stringp (plist-get config :model)))
      (dolist (candidate older)
        (let* ((other (plist-get (cl-find "thread/start" (plist-get candidate :payload) :key (lambda (r) (plist-get r :method)) :test #'equal) :params))
               (usage (slopchat-ui--context-observation candidate))
               (input (plist-get (plist-get (plist-get usage :metrics) :last) :input))
               (base (slopchat-ui--token-estimate candidate)))
          (when (and (null baseline) (equal config other) (integerp input) (> input 0) base (> (plist-get base :total) 0))
            (setq baseline candidate ratio (/ (float input) (plist-get base :total))))))
      (when baseline
        (let ((result (copy-sequence raw)))
          (dolist (key '(:instructions :tools :input :memory))
            (when (plist-member raw key)
              (setq result (plist-put result key (ceiling (* ratio (plist-get raw key)))))))
          (when (plist-member result :memory)
            (setq result (plist-put result :memory (min (plist-get result :input) (plist-get result :memory))))
            (setq result (plist-put result :otherInput (- (plist-get result :input) (plist-get result :memory)))))
          (setq result (plist-put result :total (+ (plist-get result :instructions) (plist-get result :tools) (plist-get result :input))))
          (setq result (plist-put result :method "provider-calibrated characters"))
          result)))))

(defun slopchat-ui--next-basis (chat)
  "Read-only fresh-round character basis; never submit a draft."
  (when (slopchat-chat-agent chat)
    (let* ((memory (slopchat-render chat))
           (entry (car (slopchat-context-store-entries (slopchat-chat-context chat))))
           (instructions (slopchat-ui--context-section entry "instructions"))
           (tools (slopchat-ui--context-section entry "tools"))
           (input (concat "Conversation (Emacs Lisp data):\n" (prin1-to-string (vector (list :role "user" :content (concat memory "\n\n")))))))
      (when (and (stringp instructions) (not (eq tools 'slopchat-context-field-unavailable)))
        (list :instructions (length instructions) :tools (length (prin1-to-string tools)) :input (length input) :memory (length (substring (prin1-to-string memory) 1 -1)))))))

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
      :memoryUsage ,(slopchat-memory-usage-project (slopchat-memory-usage-ledger chat))
      :nextBasis ,(or (slopchat-ui--next-basis chat) :null)
      :contextCall ,(let* ((store (slopchat-chat-context chat))
                          (entry (car (and store (slopchat-context-store-entries store)))))
                     (if entry (list :id (plist-get entry :id)
                                     :observation (slopchat-ui--context-observation entry) :lastReported (let ((reported (cl-find-if (lambda (candidate) (numberp (plist-get (plist-get (plist-get (slopchat-ui--context-observation candidate) :metrics) :last) :input))) (slopchat-context-store-entries store)))) (if reported (list :id (plist-get reported :id) :observation (slopchat-ui--context-observation reported)) :null)) :estimate (or (slopchat-ui--calibrated-estimate entry (slopchat-context-store-entries store)) (slopchat-ui--token-estimate entry) :null)) :null))
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

(defun slopchat-ui-context-calls (chat request)
  "List bounded session call metadata without copying private payloads."
  (let* ((offset (plist-get request :offset))
         (anchor (plist-get request :id))
         (limit (slopchat-ui--limit (plist-get request :limit) 20 100))
         (store (slopchat-chat-context chat))
         (entries (and store (slopchat-context-store-entries store))))
    (when (and anchor (not (stringp anchor))) (error "Invalid context call ID"))
    (unless offset
      (setq offset (if anchor
                       (* limit (/ (or (cl-position anchor entries :test #'equal
                                                    :key (lambda (entry) (plist-get entry :id))) 0) limit))
                     0)))
    (unless (natnump offset) (error "Invalid context offset"))
    (list :total (length entries) :offset offset
          :calls (vconcat
                  (cl-loop for entry in (nthcdr offset entries)
                           for index from 0 below limit
                           collect (list :id (plist-get entry :id)
                                         :terminal (if (plist-get entry :terminal) t :false)
                                         :outcome (if (plist-get entry :outcome)
                                                      (symbol-name (plist-get entry :outcome)) :null)))))))

(defun slopchat-ui--context-section (snapshot section)
  "Project captured request fields without rebuilding input."
  (if (member section '("instructions" "tools" "input"))
      (let* ((method (if (equal section "input") "turn/start" "thread/start"))
             (request (cl-find method (let ((payload (plist-get snapshot :payload))) (and (listp payload) payload)) :key (lambda (r) (plist-get r :method)) :test #'equal))
             (field (pcase section ("instructions" :baseInstructions) ("tools" :dynamicTools) ("input" :input))))
        (let ((params (plist-get request :params)))
          (if (plist-member params field) (plist-get params field) 'slopchat-context-field-unavailable)))
    (plist-get snapshot (pcase section ("payload" :payload) ("provenance" :provenance) ("events" :events)))))

(defun slopchat-ui--context-input-text (value)
  "Return literal captured text for exactly one textual input item."
  (when (and (vectorp value) (= (length value) 1)
             (cl-every (lambda (item) (and (listp item)
                         (equal (plist-get item :type) "text")
                         (stringp (plist-get item :text)))) value))
    (mapconcat (lambda (item) (plist-get item :text)) value "\n")))

(defun slopchat-ui-context (chat request)
  "Read a bounded exact snapshot page; absence is a normal result."
  (let* ((store (slopchat-chat-context chat))
         (id (plist-get request :id))
         (section (or (plist-get request :section) "payload"))
         (offset (or (plist-get request :offset) 0))
         (limit (slopchat-ui--limit (plist-get request :limit) 2000 8000)))
    (unless (member section '("payload" "provenance" "events" "instructions" "tools" "input")) (error "Invalid context section"))
    (unless (natnump offset) (error "Invalid context offset"))
    (unless (or (null id) (stringp id)) (error "Invalid context ID"))
    (unless id (setq id (plist-get (car (and store (slopchat-context-store-entries store))) :id)))
    (let ((snapshot (and store id (slopchat-context-get store id))))
      (if (not (plist-get snapshot :available))
          (list :available :false :memoryUsage (slopchat-memory-usage-project (slopchat-memory-usage-ledger chat)))
        (let* ((value (slopchat-ui--context-section snapshot section))
               (input-text (and (equal section "input") (slopchat-ui--context-input-text value)))
               (text (if (and (member section '("instructions" "tools" "input")) (eq value 'slopchat-context-field-unavailable)) "Captured field unavailable" (cond (input-text input-text) ((and (equal section "instructions") (stringp value)) value) ((equal section "tools") (pp-to-string value)) (t (prin1-to-string value)))))
               (start (min offset (length text)))
               (end (min (length text) (+ start limit))))
          `(:available t :memoryUsage ,(slopchat-memory-usage-project (slopchat-memory-usage-ledger chat)) :id ,id :terminal ,(if (plist-get snapshot :terminal) t :false)
            :outcome ,(if (plist-get snapshot :outcome) (symbol-name (plist-get snapshot :outcome)) :null)
            :estimate ,(or (slopchat-ui--calibrated-estimate snapshot (slopchat-context-store-entries store)) (slopchat-ui--token-estimate snapshot) :null) :observation ,(slopchat-ui--context-observation snapshot)
            :format ,(if (or input-text (equal section "instructions")) "text" "lisp") :offset ,start :end ,end :total ,(length text) :text ,(substring text start end)))))))


(defun slopchat-ui-tool-expression (chat request)
  "Read a page of the exact expression from the canonical tool request."
  (let* ((id (plist-get request :id))
         (offset (or (plist-get request :offset) 0)))
    (unless (and (natnump id) (natnump offset)) (error "Invalid expression page"))
    (let* ((message (gethash id (slopchat-chat-messages chat)))
           (tool (plist-get message :tool))
           (call (plist-get tool :callId))
           (first (plist-get tool :requestFirst))
           (parts (plist-get tool :requestParts))
           fragments)
      (unless (and tool (equal (plist-get message :kind) "tool")) (error "Tool request unavailable"))
      (if (and (natnump first) (natnump parts))
          (cl-loop for index from first below (+ first parts) do
                   (push (plist-get (gethash index (slopchat-chat-messages chat)) :text) fragments))
        ;; Legacy presentations repeated the whole expression in each fragment.
        (cl-loop for index from 0 below (slopchat-chat-count chat) do
                 (let ((part (gethash index (slopchat-chat-messages chat))))
                   (when (and (equal (plist-get part :kind) "tool")
                              (equal (plist-get (plist-get part :tool) :callId) call))
                     (push (plist-get part :text) fragments)))))
      (let* ((data (slopchat--json-read (apply #'concat (nreverse fragments))))
             (expression (plist-get (plist-get data :input) :expression)))
        (unless (stringp expression) (error "Tool has no expression"))
        (let* ((start (min offset (length expression)))
               (end (min (length expression) (+ start 2000))))
          (list :offset start :end end :total (length expression)
                :text (substring expression start end)))))))

(defun slopchat-ui--request (original chat process line)
  (condition-case err
      (let* ((request (slopchat--json-read line)) (action (plist-get request :action)))
        (cond
         ((equal action "tool-expression")
          (slopchat-cli--reply process `(:status "data" :value ,(slopchat-ui-tool-expression chat request))))
         ((equal action "context-calls")
          (slopchat-cli--reply process `(:status "data" :value ,(slopchat-ui-context-calls chat request))))
         ((equal action "context")
          (slopchat-cli--reply process `(:status "data" :value ,(slopchat-ui-context chat request))))
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
(defun slopchat-ui-reload (pid)
  "Explicitly build and request a TUI replacement for PID."
  (unless (and (integerp pid) (> pid 0)) (error "Expected a positive TUI PID"))
  (slopchat-run-command (format "./scripts/chat-tui-reload %d" pid)
   "/workspace/formal-proofs/slopchat" 120000))

(provide 'slopchat-ui)
