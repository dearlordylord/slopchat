;;; memory--usage.el --- Session memory-work accounting -*- lexical-binding: t -*-
(require 'cl-lib)
(defvar memory--usage--epochs (make-hash-table :test #'eq :weakness 'key))
(defvar memory--usage--ledgers (make-hash-table :test #'eq :weakness 'key))
(cl-defstruct (memory--usage (:constructor memory--usage-create))
  (started 0) (input 0) (output 0) (input-observed 0) (output-observed 0)
  (attempts (make-hash-table :test #'equal)))
;; Cache telemetry is external so existing live ledger identities stay valid.
(defvar memory--usage--cache (make-hash-table :test #'eq :weakness 'key))
(cl-defstruct (memory--cache (:constructor memory--cache-create))
  (cached-input 0) (cached-input-observed 0) (cache-write-input 0) (cache-write-input-observed 0))
(defun memory--usage-cache (ledger)
  (or (gethash ledger memory--usage--cache)
      (puthash ledger (memory--cache-create) memory--usage--cache)))
(defun memory--usage-cached-input (ledger)
  (memory--cache-cached-input (memory--usage-cache ledger)))
(gv-define-setter memory--usage-cached-input (value ledger)
  `(setf (memory--cache-cached-input (memory--usage-cache ,ledger)) ,value))
(defun memory--usage-cached-input-observed (ledger)
  (memory--cache-cached-input-observed (memory--usage-cache ledger)))
(gv-define-setter memory--usage-cached-input-observed (value ledger)
  `(setf (memory--cache-cached-input-observed (memory--usage-cache ,ledger)) ,value))
(defun memory--usage-cache-write-input (ledger)
  (memory--cache-cache-write-input (memory--usage-cache ledger)))
(gv-define-setter memory--usage-cache-write-input (value ledger)
  `(setf (memory--cache-cache-write-input (memory--usage-cache ,ledger)) ,value))
(defun memory--usage-cache-write-input-observed (ledger)
  (memory--cache-cache-write-input-observed (memory--usage-cache ledger)))
(gv-define-setter memory--usage-cache-write-input-observed (value ledger)
  `(setf (memory--cache-cache-write-input-observed (memory--usage-cache ,ledger)) ,value))
(defun memory--usage-start (ledger id)
  "Register one attempt exactly once."
  (unless (gethash id (memory--usage-attempts ledger))
    (cl-incf (memory--usage-started ledger))
    (puthash id (list :started t) (memory--usage-attempts ledger))))
(defun memory--usage-observe (ledger id counters)
  "Replace explicitly reported counters; duplicates do not increase sums."
  (let ((entry (gethash id (memory--usage-attempts ledger))))
    (when entry
      (dolist (key '(:input :output :cached-input :cache-write-input))
        (let ((value (plist-get counters key)) (old (plist-get entry key)))
          (when (natnump value)
            (pcase key
              (:input
               (cl-incf (memory--usage-input ledger) (- value (or old 0)))
               (unless old (cl-incf (memory--usage-input-observed ledger))))
              (:output
               (cl-incf (memory--usage-output ledger) (- value (or old 0)))
               (unless old (cl-incf (memory--usage-output-observed ledger))))
              (:cached-input
               (cl-incf (memory--usage-cached-input ledger) (- value (or old 0)))
               (unless old (cl-incf (memory--usage-cached-input-observed ledger))))
              (:cache-write-input
               (cl-incf (memory--usage-cache-write-input ledger) (- value (or old 0)))
               (unless old (cl-incf (memory--usage-cache-write-input-observed ledger)))))
            (setq entry (plist-put entry key value)))))
      (puthash id entry (memory--usage-attempts ledger)))))
(defun memory--usage-project (ledger)
  "Project known subtotals with separate coverage; missing is not zero."
  (append (list :started (memory--usage-started ledger)
        :input (memory--usage-input ledger)
        :output (memory--usage-output ledger)
        :inputObserved (memory--usage-input-observed ledger)
        :outputObserved (memory--usage-output-observed ledger)
        :cachedInput (memory--usage-cached-input ledger)
        :cachedInputObserved (memory--usage-cached-input-observed ledger)
        :cacheWriteInput (memory--usage-cache-write-input ledger)
        :cacheWriteInputObserved (memory--usage-cache-write-input-observed ledger))
          (gethash ledger memory--usage--epochs)))
(defun memory--usage-retire (ledger id)
  "Release late-update state without reducing accumulated totals."
  (remhash id (memory--usage-attempts ledger)))

(defun memory--usage-observe-total (ledger attempt state counters)
  "Account absolute thread COUNTERS once across all retries sharing STATE.
Coverage counts attempts with a reported counter, not per-attempt attribution.
Older and duplicate cumulative snapshots cannot add expenditure again."
  (when (gethash attempt (memory--usage-attempts ledger))
    (dolist (key '(:input :output :cached-input :cache-write-input))
      (let* ((value (plist-get counters key))
             (totals (plist-get state :totals))
             (previous (or (plist-get totals key) 0)))
        (when (natnump value)
          ;; Zero marks telemetry coverage without adding a per-request delta.
          (memory--usage-observe ledger attempt (list key 0))
          (when (> value previous)
            (let ((delta (- value previous)))
              (pcase key
                (:input (cl-incf (memory--usage-input ledger) delta))
                (:output (cl-incf (memory--usage-output ledger) delta))
                (:cached-input (cl-incf (memory--usage-cached-input ledger) delta))
                (:cache-write-input (cl-incf (memory--usage-cache-write-input ledger) delta))))
            (setf (plist-get state :totals) (plist-put totals key value))))))))

(provide 'memory-usage)
