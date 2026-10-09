;;; -*- lexical-binding: t -*-
(require 'ert)
(require 'slopchat-process)
(ert-deftest slopchat-process-completion ()
 (let ((r (slopchat-exec-command "printf hello" nil 1000))) (should (equal (plist-get r :status) "exited")) (should (= (plist-get r :exit-code) 0)) (should (string-match-p "hello" (plist-get r :output)))))
(ert-deftest slopchat-process-poll-input ()
 (let* ((r (slopchat-exec-command "read line; printf 'received:%s' \"$line\"" nil 0)) (id (plist-get r :session-id)))
 (unwind-protect (progn (should (equal (plist-get r :status) "running")) (setq r (slopchat-write-stdin id "test\n" 1000)) (should (equal (plist-get r :status) "exited")) (should (string-match-p "received:test" (plist-get r :output))) (when (gethash id slopchat-process--sessions) (slopchat-cancel-process id)))))
)
(ert-deftest slopchat-process-bounds-cancel ()
 (let* ((slopchat-process-output-limit 64) (r (slopchat-exec-command "printf '%01000d' 0" nil 1000))) (should (<= (length (plist-get r :output)) 64)) (should (> (plist-get r :dropped-chars) 0)))
 (let* ((r (slopchat-exec-command "read line" nil 0)) (id (plist-get r :session-id))) (should (equal (plist-get (slopchat-cancel-process id) :status) "exited")) (should-error (slopchat-write-stdin id)))
 (should-error (slopchat-exec-command "true" nil -1)))

