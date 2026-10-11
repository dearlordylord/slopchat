;;; slopchat-memory-usage.el --- Session memory-work accounting -*- lexical-binding: t -*-
(require 'cl-lib)
(defvar slopchat-memory-usage--epochs (make-hash-table :test #'eq :weakness 'key))
(defvar slopchat-memory-usage--ledgers (make-hash-table :test #'eq :weakness 'key))
(cl-defstruct (slopchat-memory-usage (:constructor slopchat-memory-usage-create))
  (started 0) (input 0) (output 0) (input-observed 0) (output-observed 0)
  (attempts (make-hash-table :test #'equal)))
;; Cache telemetry is external so existing live ledger identities stay valid.
(defvar slopchat-memory-usage--cache (make-hash-table :test #'eq :weakness 'key))
(cl-defstruct (slopchat-memory-cache (:constructor slopchat-memory-cache-create))
  (cached-input 0) (cached-input-observed 0) (cache-write-input 0) (cache-write-input-observed 0))
(defun slopchat-memory-usage-cache (ledger)
  (or (gethash ledger slopchat-memory-usage--cache)
      (puthash ledger (slopchat-memory-cache-create) slopchat-memory-usage--cache)))
(defun slopchat-memory-usage-cached-input (ledger)
  (slopchat-memory-cache-cached-input (slopchat-memory-usage-cache ledger)))
(gv-define-setter slopchat-memory-usage-cached-input (value ledger)
  `(setf (slopchat-memory-cache-cached-input (slopchat-memory-usage-cache ,ledger)) ,value))
(defun slopchat-memory-usage-cached-input-observed (ledger)
  (slopchat-memory-cache-cached-input-observed (slopchat-memory-usage-cache ledger)))
(gv-define-setter slopchat-memory-usage-cached-input-observed (value ledger)
  `(setf (slopchat-memory-cache-cached-input-observed (slopchat-memory-usage-cache ,ledger)) ,value))
(defun slopchat-memory-usage-cache-write-input (ledger)
  (slopchat-memory-cache-cache-write-input (slopchat-memory-usage-cache ledger)))
(gv-define-setter slopchat-memory-usage-cache-write-input (value ledger)
  `(setf (slopchat-memory-cache-cache-write-input (slopchat-memory-usage-cache ,ledger)) ,value))
(defun slopchat-memory-usage-cache-write-input-observed (ledger)
  (slopchat-memory-cache-cache-write-input-observed (slopchat-memory-usage-cache ledger)))
(gv-define-setter slopchat-memory-usage-cache-write-input-observed (value ledger)
  `(setf (slopchat-memory-cache-cache-write-input-observed (slopchat-memory-usage-cache ,ledger)) ,value))
(defun slopchat-memory-usage-ledger (chat)
  "Return session accounting independent of request snapshot retention."
  (or (gethash chat slopchat-memory-usage--ledgers)
      (puthash chat (slopchat-memory-usage-create) slopchat-memory-usage--ledgers)))
(defun slopchat-memory-usage-start (ledger id)
  "Register one attempt exactly once."
  (unless (gethash id (slopchat-memory-usage-attempts ledger))
    (cl-incf (slopchat-memory-usage-started ledger))
    (puthash id (list :started t) (slopchat-memory-usage-attempts ledger))))
(defun slopchat-memory-usage-observe (ledger id counters)
  "Replace explicitly reported counters; duplicates do not increase sums."
  (let ((entry (gethash id (slopchat-memory-usage-attempts ledger))))
    (when entry
      (dolist (key '(:input :output :cached-input :cache-write-input))
        (let ((value (plist-get counters key)) (old (plist-get entry key)))
          (when (natnump value)
            (pcase key
              (:input
               (cl-incf (slopchat-memory-usage-input ledger) (- value (or old 0)))
               (unless old (cl-incf (slopchat-memory-usage-input-observed ledger))))
              (:output
               (cl-incf (slopchat-memory-usage-output ledger) (- value (or old 0)))
               (unless old (cl-incf (slopchat-memory-usage-output-observed ledger))))
              (:cached-input
               (cl-incf (slopchat-memory-usage-cached-input ledger) (- value (or old 0)))
               (unless old (cl-incf (slopchat-memory-usage-cached-input-observed ledger))))
              (:cache-write-input
               (cl-incf (slopchat-memory-usage-cache-write-input ledger) (- value (or old 0)))
               (unless old (cl-incf (slopchat-memory-usage-cache-write-input-observed ledger)))))
            (setq entry (plist-put entry key value)))))
      (puthash id entry (slopchat-memory-usage-attempts ledger)))))
(defun slopchat-memory-usage-project (ledger)
  "Project known subtotals with separate coverage; missing is not zero."
  (append (list :started (slopchat-memory-usage-started ledger)
        :input (slopchat-memory-usage-input ledger)
        :output (slopchat-memory-usage-output ledger)
        :inputObserved (slopchat-memory-usage-input-observed ledger)
        :outputObserved (slopchat-memory-usage-output-observed ledger)
        :cachedInput (slopchat-memory-usage-cached-input ledger)
        :cachedInputObserved (slopchat-memory-usage-cached-input-observed ledger)
        :cacheWriteInput (slopchat-memory-usage-cache-write-input ledger)
        :cacheWriteInputObserved (slopchat-memory-usage-cache-write-input-observed ledger))
          (gethash ledger slopchat-memory-usage--epochs)))
(defun slopchat-memory-usage-retire (ledger id)
  "Release late-update state without reducing accumulated totals."
  (remhash id (slopchat-memory-usage-attempts ledger)))

(defun slopchat-memory-usage-observe-total (ledger attempt state counters)
  "Account absolute thread COUNTERS once across all retries sharing STATE.
Coverage counts attempts with a reported counter, not per-attempt attribution.
Older and duplicate cumulative snapshots cannot add expenditure again."
  (when (gethash attempt (slopchat-memory-usage-attempts ledger))
    (dolist (key '(:input :output :cached-input :cache-write-input))
      (let* ((value (plist-get counters key))
             (totals (plist-get state :totals))
             (previous (or (plist-get totals key) 0)))
        (when (natnump value)
          ;; Zero marks telemetry coverage without adding a per-request delta.
          (slopchat-memory-usage-observe ledger attempt (list key 0))
          (when (> value previous)
            (let ((delta (- value previous)))
              (pcase key
                (:input (cl-incf (slopchat-memory-usage-input ledger) delta))
                (:output (cl-incf (slopchat-memory-usage-output ledger) delta))
                (:cached-input (cl-incf (slopchat-memory-usage-cached-input ledger) delta))
                (:cache-write-input (cl-incf (slopchat-memory-usage-cache-write-input ledger) delta))))
            (setf (plist-get state :totals) (plist-put totals key value))))))))

(provide 'slopchat-memory-usage)
