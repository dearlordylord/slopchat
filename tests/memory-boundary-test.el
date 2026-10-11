;;; memory-boundary-test.el --- Application boundary -*- lexical-binding: t -*-
(require 'ert)
(defconst slopchat-memory-boundary-root (expand-file-name ".." (file-name-directory load-file-name)))
(ert-deftest unii-memory-public-application-has-no-private-memory-access ()
  (dolist (file '("slopchat.el" "slopchat-cli.el" "slopchat-ui.el" "slopchat-codex.el" "slopchat-model.el" "slopchat-memory-backend.el" "slopchat-memory-policy.el"))
    (with-temp-buffer
      (insert-file-contents (expand-file-name (concat "lisp/" file) slopchat-memory-boundary-root))
      (should-not (re-search-forward "\\_<unii-memory--" nil t))
      (goto-char (point-min))
      (should-not (re-search-forward "slopchat-chat-\\(?:nodes\\|messages\\|view\\|comp-view\\|cursor\\|count\\|jobs\\|leaves\\|states\\|failed\\|active\\|context\\)\\_>" nil t)))))

