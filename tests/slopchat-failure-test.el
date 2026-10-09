;;; slopchat-failure-test.el --- Accepted failures remain visible -*- lexical-binding: t -*-
(require 'ert)
(require 'slopchat-ui)

(ert-deftest slopchat-failed-accepted-input-remains-in-history ()
  (slopchat-with-chat
    (let ((slopchat-turn-function (lambda (&rest _) (error "Provider unavailable")))
          accepted failure)
      (slopchat-submit chat "hello"
                       (lambda (_text error) (setq failure error))
                       (lambda (id) (setq accepted id)))
      (should (= accepted 0))
      (should (equal failure "Provider unavailable"))
      (should-not (slopchat-chat-run chat))
      (let* ((page (slopchat-ui-history chat nil))
             (last (aref (plist-get page :messages) 1)))
        (should (equal (plist-get last :kind) "work"))
        (should (equal (plist-get last :text)
                       "Turn failed (input 0): Provider unavailable"))))))

(ert-deftest slopchat-late-failure-visible-after-acceptance ()
  (slopchat-with-chat
    (let (completion accepted)
      (let ((slopchat-turn-function
             (lambda (_chat _prompt done) (setq completion done))))
        (slopchat-submit chat "hello" nil (lambda (_) (setq accepted t))))
      (should accepted)
      (should completion)
      (funcall completion nil "Model request rejected")
      (should-not (slopchat-chat-run chat))
      (should (equal (plist-get (gethash 1 (slopchat-chat-messages chat)) :text)
                     "Turn failed (input 0): Model request rejected")))))

(ert-deftest slopchat-json-tool-text-utf8-survives-reopen ()
  (slopchat-with-chat
    (let* ((payload '(:name "emacs_eval" :input (:expression "(message \"Hello 🌍\")")))
           (bytes (json-serialize payload))
           (text (decode-coding-string bytes 'utf-8-unix)))
      (should-not (multibyte-string-p bytes))
      (slopchat-log chat "tool" bytes)
      (slopchat-close chat)
      (setq chat (slopchat-open directory))
      (let ((saved (gethash 0 (slopchat-chat-messages chat))))
        (should (equal (plist-get saved :text) text))
        (should (= (plist-get saved :size) (slopchat-bytes text)))
        (should (equal (plist-get (plist-get (slopchat--json-read (plist-get saved :text)) :input) :expression)
                       "(message \"Hello 🌍\")"))))))

(ert-deftest slopchat-ouro-bootstrap-with-unicode-expression ()
  (slopchat-with-chat
    (let ((written "(progn (defun agent (_prompt) \"Hello 🌍\") (agent \"Task\"))"))
      (cl-letf (((symbol-function 'slopchat--connection) (lambda (_) 'fake))
                ((symbol-function 'slopchat-model-response)
                 (lambda (&rest _)
                   `(((type . "tool_use") (id . "bootstrap")
                      (input . ((expression . ,written))))))))
        (should (equal (slopchat-send chat "Hello") "Hello 🌍"))
        (should (slopchat-chat-agent chat))
        (should (equal (plist-get (gethash 1 (slopchat-chat-messages chat)) :kind) "tool"))))))
