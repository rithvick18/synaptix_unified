"""Player-observation service: ingests derived webcam measurements and gameplay events,
derives a player state, and runs a deterministic suggestion policy.

Camera frames never reach this service. Only numerical observations do.
"""

SCHEMA_VERSION = "1.0"
