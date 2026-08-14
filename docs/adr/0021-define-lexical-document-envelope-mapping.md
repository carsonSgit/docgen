# Define the editor-to-document envelope mapping

The editor adapter translates serialized editor nodes into a neutral Document
Node tree and rejects unknown or malformed content before pagination or export.
The canonical model does not store editor keys, selection, or browser metadata.
