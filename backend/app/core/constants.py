"""Central place for every tunable number used by SkyTrace AI.

Nothing in the service layer should contain an unexplained literal; if a value
affects the geometry or the demo score it lives here with a comment.
"""

from __future__ import annotations

import uuid

APP_NAME = "SkyTrace AI"
SCHEMA_VERSION = "1.0.0"

# --- Units -----------------------------------------------------------------
# One international nautical mile is defined as exactly 1852 metres.
METRES_PER_NM = 1852.0
# Ellipsoid used for both the local projection and geodesic cross-checks.
ELLIPSOID = "WGS84"

# --- Input limits (validated, never clamped) ---------------------------------
MAX_ABS_LATITUDE_DEG = 89.0          # Beyond this the local projection / lon wrapping is unsupported.
MAX_GROUND_SPEED_KNOTS = 700.0
MAX_ELAPSED_MINUTES = 1440.0         # 24 hours.
MAX_WIND_SPEED_KNOTS = 200.0
MAX_POSITION_UNCERTAINTY_NM = 100.0
MAX_HEADING_UNCERTAINTY_DEG = 45.0
MIN_GRID_SIZE = 3
MAX_GRID_SIZE = 15
MAX_REGION_BUFFER_NM = 200.0
MAX_BASELINE_DISTANCE_NM = 5000.0    # speed x time cap; keeps AEQD distortion bounded.

# --- Defaults for optional inputs -------------------------------------------
DEFAULT_POSITION_UNCERTAINTY_NM = 5.0
DEFAULT_HEADING_UNCERTAINTY_DEG = 10.0
DEFAULT_GRID_SIZE = 5
DEFAULT_REGION_BUFFER_NM = 10.0

# --- Scenarios -----------------------------------------------------------------
# The outer (+/-2u) sensitivity scenarios are capped so they never swing more
# than this many degrees from the supplied heading.
MAX_OUTER_SENSITIVITY_OFFSET_DEG = 60.0

# --- Search region geometry ---------------------------------------------------
# Angular spacing of points sampled along the swept arc [h-u, h+u].
ARC_SAMPLING_STEP_DEG = 5.0
# Used only when the requested buffer is 0 and the hull degenerates to a point
# or line (e.g. zero distance or zero heading uncertainty).
MIN_DEGENERATE_BUFFER_NM = 0.5
# Segments per quarter circle for Shapely buffers (smooth but compact rings).
BUFFER_QUAD_SEGMENTS = 16
# Projected rings are densified before inverse projection so long straight
# edges in metres remain faithful once mapped to lon/lat. The segment length is
# perimeter / TARGET_RING_VERTICES, but never shorter than MIN_DENSIFY_SEGMENT_M.
TARGET_RING_VERTICES = 720
MIN_DENSIFY_SEGMENT_M = 1000.0
# Grid cells are coarser: each cell edge is split into this many pieces.
CELL_EDGE_SUBDIVISIONS = 8
# Regions/grids reaching within this distance of a pole are rejected because a
# lon/lat polygon cannot represent them cleanly.
POLE_EXCLUSION_NM = 10.0

# --- Demo grid score ---------------------------------------------------------
# sigma of the Gaussian fall-off = this fraction of the region's major extent
# (the larger of its projected bounding-box width/height).
SCORE_SIGMA_FRACTION = 0.25
# Lower bound on sigma so tiny regions never divide by ~0.
MIN_SCORE_SIGMA_M = 100.0

# --- Output rounding -----------------------------------------------------------
COORD_DECIMALS = 6      # ~0.1 m at the equator.
NM_DECIMALS = 3
DEG_DECIMALS = 3
SCORE_DECIMALS = 4
AREA_DECIMALS = 1

# Fixed namespace so analysis_id = uuid5(namespace, canonical input JSON) is
# stable across runs and machines.
ANALYSIS_ID_NAMESPACE = uuid.UUID("6f1c2a4e-5b7d-4c1e-9a3f-2d8e7b6c5a40")

# Phrases that must never appear in any response (safety wording guard).
FORBIDDEN_PHRASES = (
    "probability of",
    "most likely",
    "predicted path",
)

# Beyond this baseline distance an extra warning notes growing AEQD distortion
# of areas/shapes far from the projection centre.
AEQD_DISTORTION_WARNING_NM = 1000.0
