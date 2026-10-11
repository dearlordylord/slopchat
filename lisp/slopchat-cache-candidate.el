;;; slopchat-cache-candidate.el --- Isolated empty-fork candidate -*- lexical-binding: t -*-

;; Fresh summary contexts share cache routing through metadata-only anchors.
(require 'slopchat-codex)
(defvar slopchat-summary-cache-affinity t)
(defvar slopchat-cache--connections (make-hash-table :test #'eq :weakness 'key))
(defvar slopchat-cache-thread-provenance nil)

(cl-defstruct (slopchat-cache-anchor (:constructor slopchat-cache--anchor-create))
  path id directory instructions tools model children digest runtime-version)

(defun slopchat-cache-runtime-version (model)
  "Read MODEL's runtime metadata from the installed Codex model catalogue.
Do not let an absent runtime silently select Codex's legacy fork tool surface."
  (let* ((home (or (getenv "CODEX_HOME") (expand-file-name "~/.codex")))
         (file (expand-file-name "models_cache.json" home))
         (catalogue (with-temp-buffer
                      (insert-file-contents file)
                      (json-parse-buffer :object-type 'plist :array-type 'array)))
         (entry (cl-find model (append (plist-get catalogue :models) nil)
                         :key (lambda (item) (plist-get item :slug)) :test #'equal))
         (version (plist-get entry :multi_agent_version)))
    (unless (member version '("disabled" "v1" "v2"))
      (error "No explicit Codex runtime metadata for model %s" model))
    version))

(defun slopchat-cache--file-digest (path)
  (with-temp-buffer
    (insert-file-contents-literally path)
    (secure-hash 'sha256 (current-buffer))))

(defun slopchat-cache-anchor-create (directory instructions tools model &optional runtime-version)
  "Create an owned metadata-only rollout; never create a conversational turn."
  (let* ((runtime-version (or runtime-version (slopchat-cache-runtime-version model)))
         (_ (unless (member runtime-version '("disabled" "v1" "v2"))
              (error "Invalid Codex runtime version")))
         (hex (md5 (format "%s:%s:%s" (float-time) (random) (emacs-pid))))
         (id (format "%s-%s-4%s-8%s-%s" (substring hex 0 8) (substring hex 8 12)
                     (substring hex 13 16) (substring hex 17 20) (substring hex 20 32)))
         (path (make-temp-file "slopchat-cache-anchor-" nil ".jsonl"))
         (cwd (expand-file-name directory))
         (timestamp (format-time-string "%Y-%m-%dT%H:%M:%SZ" nil t)))
    (condition-case err
        (progn
          (with-temp-file path
            (insert (json-serialize
                     (list :timestamp timestamp :type "session_meta"
                           :payload (list :id id :session_id id :timestamp timestamp
                                          :cwd cwd :originator "slopchat-cache-candidate"
                                          :cli_version "0.162.1" :source "cli"
                                          :model_provider "openai"
                                          :multi_agent_version runtime-version
                                          :base_instructions (list :text instructions)
                                          :dynamic_tools tools))) "\n"))
          (set-file-modes path #o600)
          (slopchat-cache--anchor-create :path path :id id :directory cwd
                                        :instructions instructions :tools (copy-tree tools t)
                                        :model model :children nil :runtime-version runtime-version
                                        :digest (slopchat-cache--file-digest path)))
      (error (delete-file path) (signal (car err) (cdr err))))))

(defun slopchat-cache-anchor-close (anchor)
  "Remove only ANCHOR's owned metadata file."
  (when (file-exists-p (slopchat-cache-anchor-path anchor))
    (delete-file (slopchat-cache-anchor-path anchor))))

(defun slopchat-cache-fresh-thread (connection anchor)
  "Fork ANCHOR into a distinct ephemeral thread, rejecting inherited turns."
  (unless (and (stringp (slopchat-cache-anchor-digest anchor))
               (not (file-symlink-p (slopchat-cache-anchor-path anchor)))
               (equal (slopchat-cache-anchor-digest anchor)
                      (slopchat-cache--file-digest (slopchat-cache-anchor-path anchor))))
    (error "Empty-fork candidate rejected: anchor file changed"))
  (let* ((reply (slopchat-codex-rpc
                 connection "thread/fork"
                 (list :threadId (slopchat-cache-anchor-id anchor)
                       :path (slopchat-cache-anchor-path anchor) :ephemeral t :excludeTurns :false
                       :cwd (slopchat-cache-anchor-directory anchor) :modelProvider "openai"
                       :model (slopchat-cache-anchor-model anchor) :approvalPolicy "never"
                       :sandbox (if (> (length (slopchat-cache-anchor-tools anchor)) 0)
                                    "danger-full-access" "read-only")
                       :baseInstructions (slopchat-cache-anchor-instructions anchor)
                       :config (or (slopchat-connection-thread-config connection) (make-hash-table)))))
         (thread (plist-get reply :thread))
         (id (plist-get thread :id)))
    (unless (and (stringp id) (not (equal id (slopchat-cache-anchor-id anchor)))
                 (not (member id (slopchat-cache-anchor-children anchor)))
                 (plist-member thread :turns) (vectorp (plist-get thread :turns))
                 (= (length (plist-get thread :turns)) 0)
                 (equal (plist-get reply :model) (slopchat-cache-anchor-model anchor)))
      (when (stringp id) (slopchat-codex-forget-thread connection id))
      (error "Empty-fork candidate rejected: identity, history or model mismatch"))
    (push id (slopchat-cache-anchor-children anchor))
    id))

(defun slopchat-cache-summary-thread (connection directory instructions tools model)
  "Create an independent summary, sharing routing only for identical settings."
  (setq slopchat-cache-thread-provenance nil)
  (if (not (and slopchat-summary-cache-affinity (slopchat-connection-p connection)
                (processp (slopchat-connection-process connection))
                (process-live-p (slopchat-connection-process connection))))
      (slopchat-codex-thread connection directory instructions tools model)
    (condition-case err
        (let* ((version (slopchat-cache-runtime-version model))
               (key (secure-hash 'sha256 (prin1-to-string
                         (list (expand-file-name directory) instructions tools model version
                               (slopchat-connection-thread-config connection)))))
               (anchors (or (gethash connection slopchat-cache--connections)
                            (puthash connection (make-hash-table :test #'equal)
                                     slopchat-cache--connections)))
               (anchor (or (gethash key anchors)
                           (puthash key (slopchat-cache-anchor-create directory instructions tools model version)
                                    anchors)))
               (thread (slopchat-cache-fresh-thread connection anchor)))
          (setq slopchat-cache-thread-provenance
                (list :route "empty-fork" :anchorId (slopchat-cache-anchor-id anchor)
                      :runtimeVersion version :anchorSha256 (slopchat-cache-anchor-digest anchor)
                      :baseInstructions instructions :dynamicTools (copy-tree tools t)))
          thread)
      (error
       (setq slopchat-cache-thread-provenance
             (list :route "thread/start-fallback" :reason (error-message-string err)))
       (message "Summary cache route fallback: %s" (error-message-string err))
       (slopchat-codex-thread connection directory instructions tools model)))))

(defun slopchat-cache--close-connection (connection)
  (when-let ((anchors (gethash connection slopchat-cache--connections)))
    (maphash (lambda (_ anchor) (slopchat-cache-anchor-close anchor)) anchors)
    (remhash connection slopchat-cache--connections)))
(advice-add 'slopchat-codex-close :after #'slopchat-cache--close-connection)
(provide 'slopchat-cache-candidate)
