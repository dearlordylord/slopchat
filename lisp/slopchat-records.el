;;; slopchat-records.el --- Host record presentation and turn queue -*- lexical-binding: t -*-
(require 'cl-lib)
(require 'json)
(require 'subr-x)
(defvar slopchat-log-context-id nil)
(defun slopchat-bounded-presentation (presentation first parts)
  "Keep a bounded expression preview and a reference to the canonical request."
  (when presentation
    (let* ((copy (copy-sequence presentation))
           (expression (plist-get copy :expression)))
      (when (stringp expression)
        (setq copy (plist-put copy :expression (substring expression 0 (min 2000 (length expression)))))
        (when (> (length expression) 2000)
          (setq copy (plist-put copy :expressionTruncated t))))
      (setq copy (plist-put copy :requestFirst (or (plist-get copy :requestFirst) first)))
      (plist-put copy :requestParts (or (plist-get copy :requestParts) parts)))))

(cl-defstruct (slopchat-queue (:constructor slopchat-queue-create)) head tail)
(defun slopchat-enqueue (queue value)
  (let ((cell (list value)))
    (if (slopchat-queue-tail queue)
        (setcdr (slopchat-queue-tail queue) cell)
      (setf (slopchat-queue-head queue) cell))
    (setf (slopchat-queue-tail queue) cell)))
(defun slopchat-queue-front (queue value)
  (let ((cell (cons value (slopchat-queue-head queue))))
    (setf (slopchat-queue-head queue) cell)
    (unless (slopchat-queue-tail queue) (setf (slopchat-queue-tail queue) cell))))
(defun slopchat-dequeue (queue)
  (prog1 (pop (slopchat-queue-head queue))
    (unless (slopchat-queue-head queue) (setf (slopchat-queue-tail queue) nil))))


(defun slopchat-bytes (text) (length (encode-coding-string text 'utf-8-unix)))
(defun slopchat-split (text limit)
  "Split TEXT without losing characters, at most LIMIT UTF-8 bytes per part."
  (when (< limit 4) (error "UTF-8 chunk limit must be at least four"))
  (let ((start 0) (size 0) pieces)
    (dotimes (i (length text))
      (let ((width (slopchat-bytes (substring text i (1+ i)))))
        (when (> (+ size width) limit)
          (push (substring text start i) pieces) (setq start i size 0))
        (cl-incf size width)))
    (push (substring text start) pieces)
    (nreverse pieces)))
(defun slopchat-clip (text)
  (if (<= (length text) 30000) text
    (concat (substring text 0 15000) (substring text -15000))))

(defun slopchat--json-read (text)
  (json-parse-string text :object-type 'plist :array-type 'list
                     :null-object nil :false-object nil))

(provide 'slopchat-records)
