;;; slopchat-fidelity.el --- Boundaries of summary source data -*- lexical-binding: t -*-
(require 'cl-lib)
(require 'json)
(require 'subr-x)

(defconst slopchat-fidelity--author-regexp
  "\\(?:\\`\\|[\n;] *\\|\\. +\\)\\(user\\|tool\\|echo\\|slopchat\\|note\\|work\\):")

(defun slopchat-fidelity-author-tags (text)
  (let ((start 0) (case-fold-search t) authors)
    (while (string-match slopchat-fidelity--author-regexp text start)
      (cl-pushnew (downcase (match-string 1 text)) authors :test #'equal)
      (setq start (match-end 0)))
    (nreverse authors)))

(defun slopchat-fidelity-normalize-tags (text)
  "Canonicalize only the spelling of author tags in generated summaries."
  (let ((case-fold-search t))
    (replace-regexp-in-string
     slopchat-fidelity--author-regexp
     (lambda (tag) (replace-regexp-in-string "[A-Za-z]+:" #'downcase tag t t)) text t t)))

(defun slopchat-fidelity-normalize-result (source leaf text)
  "Normalize equivalent empty-only replies from an authoritative empty source.
Never replace nonzero counts, foreign authors, or additional reported facts."
  (let ((text (slopchat-fidelity-normalize-tags text)))
    (if (and leaf
             (member (string-trim source) '("echo: []" "echo: ()"))
             (string-match-p
              "\\`\\(?:echo: *\\)?\\(?:\\[\\]\\|()\\|[Ee]mpty collection\\|[Ee]mpty result\\|[Nn]o entries\\|Result: 0 entries; 0 summaries \\(?:pending\\|unavailable\\)\\)\\.?\\'"
              text))
        "echo: Result: 0 entries; 0 summaries unavailable."
      text)))

(defun slopchat-fidelity-prefix (envelope)
  "Required factual boundary for structured leaf results."
  (let ((author (plist-get envelope :outerAuthor)))
    (pcase (plist-get envelope :payloadKind)
      ("supplied-collection-result"
       (if (plist-member envelope :unavailableSummaries)
           (format "%s: Result: %d entries; %d summaries unavailable."
                   author (plist-get envelope :collectionCount) (plist-get envelope :unavailableSummaries))
         (format "%s: Result: %d entries." author (plist-get envelope :collectionCount))))
      ("quoted-historical-record"
       (format "%s: Quoted historical %s record %s%s:"
               author (plist-get envelope :quotedAuthor) (plist-get envelope :quotedRecordId)
               (if (equal (plist-get envelope :quotedAuthor) "tool") " (request; execution not established)" "")))
      ("possibly-clipped-result" (concat author ": Supplied result (possibly clipped; total unknown); quoted/sample data:"))
      ("unparsed-structured-data" (concat author ": Supplied data (shape unknown):")))))

(defun slopchat-fidelity-violation (source leaf text)
  "Return a structural violation; never claim full semantic validation."
  (let* ((envelope (slopchat-fidelity-envelope source leaf))
         (prefix (slopchat-fidelity-prefix envelope))
         (tags (slopchat-fidelity-author-tags text)))
    (cond
     ((and prefix (not (string-prefix-p prefix text)))
      (format "Begin with this exact factual prefix: %s" prefix))
     ((and leaf (plist-get envelope :outerAuthor)
           (cl-some (lambda (tag) (not (equal tag (plist-get envelope :outerAuthor)))) tags))
      "This is one outer message. Keep nested authors/requests quoted as data; do not create independent author: facts.")
     ((and (not leaf) (> (length (plist-get envelope :authorTags)) 0)
           (or (null tags)
               (cl-some (lambda (author) (not (member author (append (plist-get envelope :authorTags) nil)))) tags)))
      "Attribute retained facts with source author: tags; do not introduce an author absent from the children. Low-value omitted facts need no tag.")
     ((and (not leaf) (eq (plist-get envelope :possiblyClippedResult) t)
           (not (and (string-match-p "clipped" text) (string-match-p "unknown" text))))
      "Keep that the supplied result may be clipped and its total is unknown. Nested sample counts are not the result's total.")
     ((and (not leaf) (eq (plist-get envelope :quotedRequestExecutionUnknown) t)
           (or (not (and (string-match-p "quoted\\|historical" text)
                         (string-match-p "request" text)
                         (string-match-p "not established\\|unestablished\\|unconfirmed\\|execution unknown" text)))
               (string-match-p "unexecuted" text)))
      "Preserve the quoted historical request and that its execution is not established. Do not turn it into a completed or known-unexecuted action."))))

(defun slopchat-fidelity--json (text)
  "Decode JSON data, including a quoted JSON string, without executing it."
  (condition-case nil
      (let ((value text) (depth 0))
        (while (and (stringp value) (< depth 4))
          (setq value (json-parse-string value :object-type 'plist
                                         :array-type 'array :null-object :null
                                         :false-object :false))
          (cl-incf depth))
        value)
    (error nil)))

(defun slopchat-fidelity--reader-data-p (text)
  "Exclude reader constructors outside strings before parsing untrusted data."
  (let ((index 0) quoted escaped unsafe)
    (while (and (< index (length text)) (not unsafe))
      (let ((char (aref text index)))
        (cond (escaped (setq escaped nil))
              ((and quoted (= char ?\\)) (setq escaped t))
              ((= char ?\") (setq quoted (not quoted)))
              ((and (not quoted) (memq char '(?# ?\\ ??))) (setq unsafe t))))
      (cl-incf index))
    (not unsafe)))

(defun slopchat-fidelity--collection-description (entries null-value)
  (let ((observed 0) (unavailable 0))
    (mapc (lambda (row)
            (when (and (proper-list-p row) (memq :summary row))
              (let ((value (cadr (memq :summary row))))
                (when (or (stringp value) (eq value null-value))
                  (cl-incf observed)
                  (when (eq value null-value) (cl-incf unavailable)))))) entries)
    (append (list :collectionCount (length entries) :summaryFieldsObserved observed)
            (if (= observed (length entries))
                (list :unavailableSummaries unavailable)
              (list :knownUnavailableSummaries unavailable)))))

(defun slopchat-fidelity--collection (text)
  "Describe only a completely parsed outer Lisp collection, never nested text."
  (condition-case nil
      (when (and (string-prefix-p "(" (string-trim-left text))
                 (slopchat-fidelity--reader-data-p text))
       (let* ((read-circle nil)
             (parsed (read-from-string text))
             (value (car parsed))
             (tail (string-trim (substring text (cdr parsed))))
             (entries (cond ((and (listp value) (plist-member value :entries)) (plist-get value :entries))
                            ((and (listp value) (keywordp (car value))) :object)
                            (t value))))
        (when (and (string-empty-p tail) (proper-list-p entries)
                   (or entries (string= (string-trim text) "()")
                       (and (listp value) (plist-member value :entries))))
          (slopchat-fidelity--collection-description entries nil))))
    (error nil)))

(defun slopchat-fidelity--json-collection (value)
  "Describe an outer JSON array or an explicit entries array."
  (let ((entries (if (and (listp value) (plist-member value :entries))
                     (plist-get value :entries) value)))
    (when (vectorp entries)
      (slopchat-fidelity--collection-description entries :null))))

(defun slopchat-fidelity-envelope (source leaf)
  "Return source boundaries independently of quoted author labels.
This is auxiliary metadata; SOURCE itself remains byte-for-byte unchanged."
  (if (not leaf)
      (let ((authors (slopchat-fidelity-author-tags source)))
        (list :scope "two-child-summaries" :authorTags (vconcat authors)
              :possiblyClippedResult (if (and (string-match-p "clipped" source) (string-match-p "unknown" source)) t :false)
              :quotedRequestExecutionUnknown
              (if (and (string-match-p "quoted\\(?: historical\\)? tool record" source)
                       (string-match-p "not established\\|unestablished\\|unconfirmed\\|execution unknown" source)) t :false)
              :instruction "Keep each retained fact under its exact author: tag; never place a tool fact under echo. Quoted requests remain quoted requests."))
    (when (string-match "\\`\\([a-z]+\\): " source)
      (let* ((author (match-string 1 source))
             (text (substring source (match-end 0)))
             (json (slopchat-fidelity--json text))
             (record (and (listp json) (plist-member json :id)
                          (stringp (plist-get json :kind))
                          (stringp (plist-get json :text)) json)))
        (append (list :scope "one-message" :outerAuthor author)
                (cond
                 ((equal author "tool")
                  '(:payloadKind "tool-request"
                    :instruction "This outer event is a request, not its result or proof of execution."))
                 ((and (equal author "echo") (>= (length text) 30000))
                  ;; The persisted head/tail clipping format has no marker and
                  ;; can accidentally remain syntactically valid Lisp. Parsed
                  ;; length must not masquerade as the complete result count.
                  '(:payloadKind "possibly-clipped-result"
                    :instruction "A result was supplied at the tool-output clipping limit. It may contain head/tail data only; total record count and completeness are unknown. Describe inner counts as quoted/sample/context-store counts, never as this result's total. Preserve that it returned data; do not claim no result or no entries."))
                 (record
                    (list :payloadKind "quoted-historical-record"
                          :quotedRecordId (plist-get record :id)
                          :quotedAuthor (plist-get record :kind)
                          :quotedEvent (if (equal (plist-get record :kind) "tool")
                                           "request-only; execution is not established by this record"
                                         "historical data, not an outer event")))
                 ((not (equal author "echo")) nil)
                 (t
                  (let ((collection (or (slopchat-fidelity--json-collection json)
                                        (slopchat-fidelity--collection text))))
                    (if collection
                        (append '(:payloadKind "supplied-collection-result") collection)
                      (when (string-match-p "\\`[({[\"]" (string-trim-left text))
                        '(:payloadKind "unparsed-structured-data"
                          :instruction "A payload was supplied. Parsing/collection completeness is unknown; do not call it an absent or empty result.")))))))))))

(provide 'slopchat-fidelity)
