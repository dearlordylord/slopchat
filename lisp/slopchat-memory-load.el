;;; slopchat-memory-load.el --- Load the source unii-memory dependency -*- lexical-binding: t -*-
(let ((directory (expand-file-name "../vendor/unii-memory" (file-name-directory (or load-file-name buffer-file-name)))))
  (unless (file-exists-p (expand-file-name "unii-memory.el" directory))
    (error "Missing unii-memory: run git submodule update --init --recursive"))
  (add-to-list 'load-path directory))
(require 'unii-memory)
(provide 'slopchat-memory-load)
;;; slopchat-memory-load.el ends here
