;;; boot.el --- One request, one round of eval; The model writes the loop -*- lexical-binding: t -*-

(require 'cl-lib)
(add-to-list 'load-path (expand-file-name "lisp" (file-name-directory load-file-name)))
(require 'slopchat-model)
(defvar agent-model nil)
(defvar agent-model-function #'slopchat-model-default
  "Adapter (MESSAGES) returning content blocks; never executes Lisp.")
(defvar agent-eval-function nil "Optional host evaluator (EXPRESSION).")
(defvar agent-eval-count 0)

(defvar this-file
  (with-temp-buffer (insert-file-contents load-file-name) (buffer-string))
  "The contents of this file.")

(defvar agent-boot-prompt
  "You are running inside GNU Emacs. Your only tool, eval, evaluates Emacs \
Lisp in this Emacs. This is your harness:

%s

This call is a bootstrap: `agent' makes one request, runs your evals once \
for side effects, and drops their results. You will not see any eval result \
in this call, so do not explore. In a single eval, redefine `agent' so that \
it sends tool_result blocks back through `agent-prompt' and loops until you \
reply without calling a tool. Use alist response blocks (type, id, name, input, expression); messages use
:role and :content. Use vectors for message arrays. Call agent-eval for each
expression, and return final text as a string. Keep history local to each
invocation of agent.
Write authored code and comments in English; preserve user-provided text as data.
Then call your new `agent' with the user's task:

%s")

(defun agent-prompt (messages)
  "Return one model response. The Lisp agent owns all continuation."
  (funcall agent-model-function messages))

(defun agent-stop ()
  "Close the standalone model adapter."
  (slopchat-model-stop))

(defun agent-eval (expression)
  "Eval EXPRESSION (a string) and return the printed result or error."
  (condition-case err
      (progn (cl-incf agent-eval-count)
        (if agent-eval-function (funcall agent-eval-function expression)
          (prin1-to-string (eval (read expression) t))))
    (error (error-message-string err))))

(defun agent (prompt)
  "Send PROMPT; run any eval the model asks for once."
  (mapconcat
   (lambda (block)
     (if (equal (alist-get 'type block) "tool_use")
         (agent-eval (alist-get 'expression (alist-get 'input block)))
       (or (alist-get 'text block) "")))
   (agent-prompt `[(:role "user" :content ,prompt)])
   ""))

(defun agent-boot (task)
  (agent (format agent-boot-prompt this-file task)))

(defalias 'agent-bootstrap (symbol-function 'agent))
(provide 'ouro-boot)
;;; boot.el ends here
