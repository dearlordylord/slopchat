;;; memory-module-package-check.el --- Prove four-file extraction without the app -*- lexical-binding: t -*-
(require 'json)
(let* ((root (expand-file-name "../lisp" (file-name-directory (or load-file-name buffer-file-name))))
       (package (make-temp-file "memory-package-" t))
       (files '("memory.el" "memory-store.el" "memory-usage.el" "memory-context.el"))
       (emacs (expand-file-name invocation-name invocation-directory))
       (program
        '(progn
           (require 'memory)
           (when (or (featurep 'slopchat) (featurep 'slopchat-codex) (fboundp 'agent))
             (error "Standalone memory loaded the application"))
           (let* ((directory (make-temp-file "memory-export-smoke-" t))
                  (calls 0)
                  (backend (list :start (lambda (_request emit done)
                                          (cl-incf calls)
                                          (funcall emit '(:kind usage :scope attempt :source fake :counters (:input 10 :cached-input 0 :output 2)))
                                          (funcall done '(:text "user: standalone source retained")))))
                  (memory (memory-open directory :backend backend)))
             (unwind-protect
                 (progn
                   (memory-append memory (list :kind "user" :text (make-string 600 ?a)))
                   (memory-append memory (list :kind "user" :text (make-string 600 ?b)))
                   (memory-step memory)
                   (unless (= calls 2) (error "Standalone backend was not invoked"))
                   (let ((snapshot (memory-snapshot memory)) (usage (memory-inspect memory 'usage)))
                     (unless (and (eq (plist-get snapshot :state) 'ready)
                                  (= (plist-get usage :input) 20) (= (plist-get usage :cachedInputObserved) 2))
                       (error "Standalone state/accounting failed"))
                     (memory-close memory) (setq memory (memory-open directory))
                     (unless (equal snapshot (memory-snapshot memory)) (error "Standalone reopen changed context"))
                     (princ (json-serialize (list :passed t :applicationLoaded :false :copiedSourceFiles 4 :records 2
                                                 :backendAttempts calls :input 20 :cachedInput 0 :cacheCoverage 2 :reopenIdentical t)))))
               (memory-close memory) (delete-directory directory t))))))
  (unwind-protect
      (progn
        (dolist (file files) (copy-file (expand-file-name file root) (expand-file-name file package)))
        (with-temp-buffer
          (let ((status (call-process emacs nil (current-buffer) nil "--batch" "-Q" "-L" package "--eval" (prin1-to-string program))))
            (unless (zerop status) (error "Standalone package check failed: %s" (buffer-string)))
            (write-region (point-min) (point-max) "/tmp/memory-module-package.json" nil 'silent)
            (princ (buffer-string)))))
    (delete-directory package t)))
