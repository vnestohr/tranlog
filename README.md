# tranlog (Transaction Log File)
## Summary:
A logging scheme based on the need to 'follow' operations or transactions through a codebase.

## Description:
Most logging schemes follow a simple code based 'checkpoint' strategy where log messages are generated when the logic flow reaches 
some *location* in the code.  One helpful refinement is to define message *types*, but even so it can be a daunting task to search 
through the log file(s) for things related to a specific *transaction* of interest to follow its progress through the logic.

The tranlog log file scheme is a further logging refinement that uses the concept of 'tags' to allow all the messages that are
specific to a transaction to be logged to its own log file.  This can be instead of, or in addition to, messages getting logged 
to the general log file.

