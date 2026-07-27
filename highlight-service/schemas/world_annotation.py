"""Substream World Annotation schema, version 1 (SWA-1).

SWA-1 is the annotation contract for the Substream gameplay corpus. It exists to
turn raw gameplay video into supervision that an action-conditioned video model
can actually train on, rather than the loose clip-ranking labels that highlight
detection needs.

Four layers, each independently useful:

  Layer 0  Engine telemetry     Ground-truth input + game state from the SDK,
                                aligned to video presentation timestamps. When
                                present, it turns inferred labels into verified
                                ones.
  Layer 1  Episode metadata     Identity, capture profile, consent, licensing.
  Layer 2  Dense window         Camera, agent, entities, events, physics, UI
                                readings and reward proxy per short window.
                                This is the core training signal.
  Layer 3  Narrative            Highlight-facing judgements layered on top.

The taxonomies below are deliberately closed. Free-text labels are unusable as
training targets across a large corpus because the same concept arrives under a
dozen spellings, so every categorical field resolves to a fixed vocabulary and
free text is confined to the `*_note` and `reason` fields.

The `*_SCHEMA` dicts are Gemini `response_schema` values and are restricted to
the JSON Schema subset that structured output supports: no `anyOf`, no `oneOf`,
no `$ref`, no `additionalProperties`.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

SCHEMA_VERSION = "swa-1"


# --------------------------------------------------------------------------
# Closed taxonomies
# --------------------------------------------------------------------------


class Genre(str, Enum):
    """Genre vocabulary.

    Extended beyond the original FPS/MOBA/BR/sports set so that party battle
    royales, turn-based social board games and real-world AR titles resolve to
    something meaningful instead of falling through to `other`.
    """

    FPS = "fps"
    ARENA_SHOOTER = "arena_shooter"
    MOBA = "moba"
    BATTLE_ROYALE = "battle_royale"
    PARTY_BATTLE_ROYALE = "party_battle_royale"
    CASUAL_BOARD_SOCIAL = "casual_board_social"
    AR_LOCATION = "ar_location"
    SPORTS = "sports"
    RACING = "racing"
    RPG = "rpg"
    STRATEGY = "strategy"
    PLATFORMER = "platformer"
    FIGHTING = "fighting"
    SIMULATION = "simulation"
    PUZZLE = "puzzle"
    IDLE_CLICKER = "idle_clicker"
    OTHER = "other"


class Perspective(str, Enum):
    FIRST_PERSON = "first_person"
    THIRD_PERSON_CLOSE = "third_person_close"
    THIRD_PERSON_FAR = "third_person_far"
    TOP_DOWN = "top_down"
    ISOMETRIC = "isometric"
    SIDE_SCROLL = "side_scroll"
    FIXED = "fixed"
    MAP_OVERVIEW = "map_overview"
    AR_WORLD = "ar_world"
    MENU = "menu"


class CameraMotion(str, Enum):
    STATIC = "static"
    PAN_LEFT = "pan_left"
    PAN_RIGHT = "pan_right"
    TILT_UP = "tilt_up"
    TILT_DOWN = "tilt_down"
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    ORBIT = "orbit"
    DOLLY_FORWARD = "dolly_forward"
    DOLLY_BACK = "dolly_back"
    FOLLOW = "follow"
    SHAKE = "shake"
    WHIP = "whip"
    CUT = "cut"


class ActionCategory(str, Enum):
    LOCOMOTION = "locomotion"
    COMBAT = "combat"
    INTERACTION = "interaction"
    SOCIAL = "social"
    NAVIGATION = "navigation"
    META = "meta"


class Action(str, Enum):
    """Atomic action verbs spanning shooters, party platformers, board games and AR."""

    # locomotion
    IDLE = "idle"
    WALK = "walk"
    RUN = "run"
    SPRINT = "sprint"
    JUMP = "jump"
    DOUBLE_JUMP = "double_jump"
    FALL = "fall"
    CLIMB = "climb"
    SWIM = "swim"
    SLIDE = "slide"
    DASH = "dash"
    DIVE = "dive"
    CROUCH = "crouch"
    MOUNT = "mount"
    DISMOUNT = "dismount"
    TELEPORT = "teleport"
    # combat
    AIM = "aim"
    FIRE = "fire"
    MELEE = "melee"
    RELOAD = "reload"
    THROW = "throw"
    BLOCK = "block"
    DODGE = "dodge"
    TAKE_DAMAGE = "take_damage"
    DEAL_DAMAGE = "deal_damage"
    ELIMINATE = "eliminate"
    DIE = "die"
    RESPAWN = "respawn"
    HEAL = "heal"
    # interaction
    PICKUP = "pickup"
    DROP = "drop"
    USE_ITEM = "use_item"
    OPEN = "open"
    CLOSE = "close"
    ACTIVATE = "activate"
    BUILD = "build"
    PLACE = "place"
    ROTATE = "rotate"
    DRAG = "drag"
    TAP = "tap"
    SWIPE = "swipe"
    SPIN = "spin"
    ROLL_DICE = "roll_dice"
    TRADE = "trade"
    PURCHASE = "purchase"
    # social
    EMOTE = "emote"
    CHAT = "chat"
    SPECTATE = "spectate"
    FOLLOW_PLAYER = "follow_player"
    TEAM_UP = "team_up"
    # navigation / AR
    WALK_REAL_WORLD = "walk_real_world"
    SCAN_ENVIRONMENT = "scan_environment"
    THROW_BALL = "throw_ball"
    CATCH = "catch"
    ROTATE_DEVICE = "rotate_device"
    AR_PLACE = "ar_place"
    # meta
    MENU_NAVIGATE = "menu_navigate"
    LOADING = "loading"
    CUTSCENE = "cutscene"
    REPLAY = "replay"
    NONE = "none"


class MovementMode(str, Enum):
    GROUNDED = "grounded"
    AIRBORNE = "airborne"
    MOUNTED = "mounted"
    VEHICLE = "vehicle"
    SWIMMING = "swimming"
    CLIMBING = "climbing"
    STATIONARY = "stationary"
    REAL_WORLD_WALKING = "real_world_walking"
    NONE = "none"


class EventType(str, Enum):
    ELIMINATION = "elimination"
    DEATH = "death"
    NEAR_MISS = "near_miss"
    CLUTCH_SURVIVAL = "clutch_survival"
    VICTORY = "victory"
    DEFEAT = "defeat"
    ROUND_START = "round_start"
    ROUND_END = "round_end"
    CHECKPOINT = "checkpoint"
    RESPAWN = "respawn"
    LEVEL_UP = "level_up"
    SCORE_CHANGE = "score_change"
    STREAK_START = "streak_start"
    STREAK_END = "streak_end"
    STREAK_BREAK = "streak_break"
    COMBO = "combo"
    JACKPOT = "jackpot"
    REWARD_GRANTED = "reward_granted"
    REWARD_LOST = "reward_lost"
    ITEM_ACQUIRED = "item_acquired"
    ITEM_LOST = "item_lost"
    CURRENCY_GAIN = "currency_gain"
    CURRENCY_LOSS = "currency_loss"
    COLLISION = "collision"
    FALL_OFF_MAP = "fall_off_map"
    KNOCKBACK = "knockback"
    OBSTACLE_HIT = "obstacle_hit"
    GOAL_SCORED = "goal_scored"
    CATCH_SUCCESS = "catch_success"
    CATCH_FAIL = "catch_fail"
    RAID_START = "raid_start"
    RAID_WIN = "raid_win"
    RARE_ENCOUNTER = "rare_encounter"
    TRADE_COMPLETE = "trade_complete"
    PURCHASE = "purchase"
    RANK_CHANGE = "rank_change"
    TEAM_WIPE = "team_wipe"
    COMEBACK = "comeback"
    BLUNDER = "blunder"
    UI_POPUP = "ui_popup"
    SPECTATOR_REACTION = "spectator_reaction"
    AUDIO_SPIKE = "audio_spike"
    NONE = "none"


class Outcome(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"
    NEUTRAL = "neutral"
    UNKNOWN = "unknown"


class PhysicsEvent(str, Enum):
    NONE = "none"
    COLLISION = "collision"
    LAUNCH = "launch"
    FALL = "fall"
    BOUNCE = "bounce"
    RAGDOLL = "ragdoll"
    SLIDE = "slide"
    TUMBLE = "tumble"
    KNOCKBACK = "knockback"
    EXPLOSION = "explosion"
    WATER_ENTRY = "water_entry"
    PLATFORM_BREAK = "platform_break"
    CONVEYOR = "conveyor"
    ROTATION = "rotation"


class EntityRole(str, Enum):
    PLAYER = "player"
    ALLY = "ally"
    OPPONENT = "opponent"
    NPC = "npc"
    CREATURE = "creature"
    PROJECTILE = "projectile"
    VEHICLE = "vehicle"
    PICKUP = "pickup"
    OBSTACLE = "obstacle"
    HAZARD = "hazard"
    PLATFORM = "platform"
    GOAL = "goal"
    UI_ELEMENT = "ui_element"
    SCENERY = "scenery"
    UNKNOWN = "unknown"


class Pacing(str, Enum):
    SLOW = "slow"
    BUILDING = "building"
    INTENSE = "intense"
    CLIMACTIC = "climactic"
    CALM = "calm"


class NarrativeRole(str, Enum):
    SETUP = "setup"
    BUILD = "build"
    CLIMAX = "climax"
    RESOLUTION = "resolution"
    COMEDIC_BEAT = "comedic_beat"
    TRANSITION = "transition"
    FILLER = "filler"


class EmotionalValence(str, Enum):
    TRIUMPHANT = "triumphant"
    TENSE = "tense"
    FRUSTRATING = "frustrating"
    FUNNY = "funny"
    SURPRISING = "surprising"
    SATISFYING = "satisfying"
    ANTICLIMACTIC = "anticlimactic"
    NEUTRAL = "neutral"


def enum_values(enum_cls: type[Enum]) -> list[str]:
    return [member.value for member in enum_cls]


# --------------------------------------------------------------------------
# Layer 0: engine telemetry (SDK-provided ground truth)
# --------------------------------------------------------------------------


class InputSample(BaseModel):
    """One input sample from the game client, at native polling rate."""

    t: float = Field(..., description="Seconds from episode start, aligned to video PTS")
    keys: list[str] = Field(default_factory=list, description="Held key/button identifiers")
    axes: dict[str, float] = Field(default_factory=dict, description="Analog axes, -1..1")
    pointer: Optional[list[float]] = Field(
        default=None, description="Normalized pointer/touch position [x, y]"
    )
    camera_delta: Optional[list[float]] = Field(
        default=None, description="Look delta [dyaw, dpitch] in degrees"
    )


class StateSample(BaseModel):
    """One game-state sample from the game client."""

    t: float = Field(..., description="Seconds from episode start, aligned to video PTS")
    position: Optional[list[float]] = Field(default=None, description="World position [x, y, z]")
    rotation: Optional[list[float]] = Field(default=None, description="Euler [yaw, pitch, roll]")
    velocity: Optional[list[float]] = Field(default=None, description="Linear velocity [x, y, z]")
    health: Optional[float] = None
    score: Optional[float] = None
    currency: Optional[float] = None
    rank: Optional[int] = None
    animation: Optional[str] = Field(default=None, description="Active animation state name")
    extra: dict[str, Any] = Field(default_factory=dict, description="Title-specific fields")


class EngineTelemetry(BaseModel):
    """Ground-truth telemetry for one episode.

    This is the layer that external video scrapers cannot reproduce. Public
    datasets in this space reconstruct it by parsing replay files or by
    instrumenting a single title; an SDK embedded in the game reports it
    directly, which is what allows inferred annotations to be verified rather
    than trusted.
    """

    sample_rate_hz: float = Field(default=0.0, description="Nominal telemetry rate")
    clock_offset_seconds: float = Field(
        default=0.0,
        description="Offset applied to align telemetry clock with video PTS",
    )
    inputs: list[InputSample] = Field(default_factory=list)
    states: list[StateSample] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Layer 1: episode metadata
# --------------------------------------------------------------------------


class ConsentFlags(BaseModel):
    """Consent and licensing posture for one episode.

    Corpus records carry their own rights metadata so that a downstream export
    can be filtered without going back to an external system. An episode that
    is missing `training_use` never reaches a training export.
    """

    player_consented: bool = Field(default=False)
    training_use: bool = Field(default=False, description="Cleared for model training")
    commercial_license: bool = Field(default=False, description="Cleared for third-party licensing")
    contains_real_world_video: bool = Field(
        default=False,
        description="Camera passthrough / AR footage, which carries bystander-privacy obligations",
    )
    contains_voice: bool = Field(default=False)
    pii_review_status: str = Field(default="pending", description="pending | cleared | blocked")
    retention_days: Optional[int] = Field(default=None)


class CaptureProfile(BaseModel):
    width: int = 0
    height: int = 0
    fps: float = 0.0
    video_codec: str = ""
    audio_codec: str = ""
    video_bitrate_kbps: Optional[int] = None
    duration_seconds: float = 0.0


class EpisodeMetadata(BaseModel):
    """Layer 1. Identity and provenance for one gameplay episode."""

    schema_version: str = Field(default=SCHEMA_VERSION)
    episode_id: str
    session_id: Optional[str] = None
    game_id: Optional[str] = None
    game_title: Optional[str] = None
    game_build: Optional[str] = None
    platform: Optional[str] = Field(default=None, description="ios | android | web | unity | pc")
    sdk_version: Optional[str] = None
    player_id_hashed: Optional[str] = Field(
        default=None, description="Salted hash; never a raw account identifier"
    )
    locale: Optional[str] = None
    genre: Genre = Field(default=Genre.OTHER)
    perspective: Perspective = Field(default=Perspective.THIRD_PERSON_FAR)
    capture: CaptureProfile = Field(default_factory=CaptureProfile)
    consent: ConsentFlags = Field(default_factory=ConsentFlags)
    source_uri: Optional[str] = None
    captured_at: Optional[str] = None
    has_engine_telemetry: bool = Field(default=False)


# --------------------------------------------------------------------------
# Layer 2: dense window annotation
# --------------------------------------------------------------------------


class BoundingBox(BaseModel):
    """Normalized screen-space box, origin top-left, values 0..1."""

    x: float
    y: float
    w: float
    h: float


class EntityObservation(BaseModel):
    entity_id: str = Field(..., description="Stable within an episode where re-identifiable")
    role: EntityRole = Field(default=EntityRole.UNKNOWN)
    label: str = Field(default="", description="Short free-text descriptor")
    salience: int = Field(default=0, ge=0, le=100)
    bbox: Optional[BoundingBox] = None
    state_note: str = Field(default="")


class AnnotatedEvent(BaseModel):
    event_id: str
    event_type: EventType = Field(default=EventType.NONE)
    t: float = Field(..., description="Seconds from episode start")
    outcome: Outcome = Field(default=Outcome.UNKNOWN)
    magnitude: int = Field(default=0, ge=0, le=100)
    subject_entity_id: str = Field(default="")
    object_entity_id: str = Field(default="")
    cause_event_id: str = Field(
        default="",
        description="Event that caused this one, forming a causal chain",
    )
    note: str = Field(default="")


class CameraObservation(BaseModel):
    perspective: Perspective = Field(default=Perspective.THIRD_PERSON_FAR)
    motion: CameraMotion = Field(default=CameraMotion.STATIC)
    motion_magnitude: int = Field(default=0, ge=0, le=100)
    yaw_rate_note: str = Field(default="", description="Qualitative turn rate")
    shake: int = Field(default=0, ge=0, le=100)
    cut_detected: bool = Field(default=False)


class AgentObservation(BaseModel):
    action_category: ActionCategory = Field(default=ActionCategory.META)
    action: Action = Field(default=Action.NONE)
    secondary_action: Action = Field(default=Action.NONE)
    movement_mode: MovementMode = Field(default=MovementMode.NONE)
    intent: str = Field(default="", description="Short inferred goal for this window")
    control_confidence: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Confidence that the annotated agent is the one under player control",
    )


class UIState(BaseModel):
    """HUD readings. Populated from on-screen text, so it can be wrong."""

    score: Optional[float] = None
    timer_seconds: Optional[float] = None
    lives: Optional[int] = None
    health_pct: Optional[float] = None
    currency: Optional[float] = None
    rank: Optional[int] = None
    players_remaining: Optional[int] = None
    raw_text: list[str] = Field(default_factory=list)


class Uncertainty(BaseModel):
    """Per-field confidence, so low-confidence rows can be filtered from exports."""

    camera: int = Field(default=0, ge=0, le=100)
    agent: int = Field(default=0, ge=0, le=100)
    entities: int = Field(default=0, ge=0, le=100)
    events: int = Field(default=0, ge=0, le=100)
    ui_state: int = Field(default=0, ge=0, le=100)


class DenseWindow(BaseModel):
    """Layer 2. The core training signal for one short window of gameplay."""

    window_id: str
    t_start: float
    t_end: float
    camera: CameraObservation = Field(default_factory=CameraObservation)
    agent: AgentObservation = Field(default_factory=AgentObservation)
    entities: list[EntityObservation] = Field(default_factory=list)
    events: list[AnnotatedEvent] = Field(default_factory=list)
    physics: list[PhysicsEvent] = Field(default_factory=list)
    affordances: list[str] = Field(
        default_factory=list, description="Interactions available to the player right now"
    )
    ui_state: UIState = Field(default_factory=UIState)
    reward_signal: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
        description="Progress proxy for this window; negative means regression",
    )
    scene_caption: str = Field(default="", description="One-sentence description of the window")
    uncertainty: Uncertainty = Field(default_factory=Uncertainty)
    telemetry_verified: bool = Field(
        default=False,
        description="True when Layer 0 telemetry corroborated the inferred action",
    )


# --------------------------------------------------------------------------
# Layer 3: narrative / highlight layer
# --------------------------------------------------------------------------


class NarrativeSegment(BaseModel):
    """Layer 3. Highlight-facing judgement over a span of windows."""

    segment_id: str
    t_start: float
    t_end: float
    score: float = Field(default=0.0, ge=0.0, le=100.0)
    label: str = Field(default="")
    reason: str = Field(default="")
    pacing: Pacing = Field(default=Pacing.INTENSE)
    narrative_role: NarrativeRole = Field(default=NarrativeRole.BUILD)
    shareability: int = Field(default=0, ge=0, le=100)
    emotional_valence: EmotionalValence = Field(default=EmotionalValence.NEUTRAL)
    spoiler_risk: int = Field(default=0, ge=0, le=100)
    protected_chain: bool = Field(
        default=False,
        description="Span contains a causal action chain that must not be cut apart",
    )


class Episode(BaseModel):
    """A complete annotated episode: the unit of the corpus."""

    metadata: EpisodeMetadata
    windows: list[DenseWindow] = Field(default_factory=list)
    segments: list[NarrativeSegment] = Field(default_factory=list)
    telemetry: Optional[EngineTelemetry] = None


# --------------------------------------------------------------------------
# Gemini response schemas
# --------------------------------------------------------------------------

_BBOX_SCHEMA = {
    "type": "object",
    "properties": {
        "x": {"type": "number"},
        "y": {"type": "number"},
        "w": {"type": "number"},
        "h": {"type": "number"},
    },
    "required": ["x", "y", "w", "h"],
    "propertyOrdering": ["x", "y", "w", "h"],
}

TRIAGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "salience": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "How likely this window contains something worth annotating densely",
        },
        "reason": {"type": "string"},
        "likely_events": {
            "type": "array",
            "items": {"type": "string", "enum": enum_values(EventType)},
        },
        "is_gameplay": {
            "type": "boolean",
            "description": "False for menus, loading screens and idle lobbies",
        },
    },
    "required": ["salience", "reason", "likely_events", "is_gameplay"],
    "propertyOrdering": ["salience", "is_gameplay", "likely_events", "reason"],
}

DENSE_WINDOW_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "camera": {
            "type": "object",
            "properties": {
                "perspective": {"type": "string", "enum": enum_values(Perspective)},
                "motion": {"type": "string", "enum": enum_values(CameraMotion)},
                "motion_magnitude": {"type": "integer", "minimum": 0, "maximum": 100},
                "yaw_rate_note": {"type": "string"},
                "shake": {"type": "integer", "minimum": 0, "maximum": 100},
                "cut_detected": {"type": "boolean"},
            },
            "required": ["perspective", "motion", "motion_magnitude", "shake", "cut_detected"],
            "propertyOrdering": [
                "perspective",
                "motion",
                "motion_magnitude",
                "shake",
                "cut_detected",
                "yaw_rate_note",
            ],
        },
        "agent": {
            "type": "object",
            "properties": {
                "action_category": {"type": "string", "enum": enum_values(ActionCategory)},
                "action": {"type": "string", "enum": enum_values(Action)},
                "secondary_action": {"type": "string", "enum": enum_values(Action)},
                "movement_mode": {"type": "string", "enum": enum_values(MovementMode)},
                "intent": {"type": "string"},
                "control_confidence": {"type": "integer", "minimum": 0, "maximum": 100},
            },
            "required": [
                "action_category",
                "action",
                "movement_mode",
                "intent",
                "control_confidence",
            ],
            "propertyOrdering": [
                "action_category",
                "action",
                "secondary_action",
                "movement_mode",
                "intent",
                "control_confidence",
            ],
        },
        "entities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "entity_id": {"type": "string"},
                    "role": {"type": "string", "enum": enum_values(EntityRole)},
                    "label": {"type": "string"},
                    "salience": {"type": "integer", "minimum": 0, "maximum": 100},
                    "bbox": _BBOX_SCHEMA,
                    "state_note": {"type": "string"},
                },
                "required": ["entity_id", "role", "label", "salience"],
                "propertyOrdering": [
                    "entity_id",
                    "role",
                    "label",
                    "salience",
                    "bbox",
                    "state_note",
                ],
            },
        },
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "string"},
                    "event_type": {"type": "string", "enum": enum_values(EventType)},
                    "t": {"type": "number", "description": "Seconds from start of the video"},
                    "outcome": {"type": "string", "enum": enum_values(Outcome)},
                    "magnitude": {"type": "integer", "minimum": 0, "maximum": 100},
                    "subject_entity_id": {"type": "string"},
                    "object_entity_id": {"type": "string"},
                    "cause_event_id": {
                        "type": "string",
                        "description": "event_id of the event that caused this one, else empty",
                    },
                    "note": {"type": "string"},
                },
                "required": ["event_id", "event_type", "t", "outcome", "magnitude"],
                "propertyOrdering": [
                    "event_id",
                    "event_type",
                    "t",
                    "outcome",
                    "magnitude",
                    "subject_entity_id",
                    "object_entity_id",
                    "cause_event_id",
                    "note",
                ],
            },
        },
        "physics": {
            "type": "array",
            "items": {"type": "string", "enum": enum_values(PhysicsEvent)},
        },
        "affordances": {"type": "array", "items": {"type": "string"}},
        "ui_state": {
            "type": "object",
            "properties": {
                "score": {"type": "number"},
                "timer_seconds": {"type": "number"},
                "lives": {"type": "integer"},
                "health_pct": {"type": "number"},
                "currency": {"type": "number"},
                "rank": {"type": "integer"},
                "players_remaining": {"type": "integer"},
                "raw_text": {"type": "array", "items": {"type": "string"}},
            },
            "propertyOrdering": [
                "score",
                "timer_seconds",
                "lives",
                "health_pct",
                "currency",
                "rank",
                "players_remaining",
                "raw_text",
            ],
        },
        "reward_signal": {
            "type": "number",
            "description": "-1..1 progress proxy; negative means the player lost ground",
        },
        "scene_caption": {"type": "string"},
        "uncertainty": {
            "type": "object",
            "properties": {
                "camera": {"type": "integer", "minimum": 0, "maximum": 100},
                "agent": {"type": "integer", "minimum": 0, "maximum": 100},
                "entities": {"type": "integer", "minimum": 0, "maximum": 100},
                "events": {"type": "integer", "minimum": 0, "maximum": 100},
                "ui_state": {"type": "integer", "minimum": 0, "maximum": 100},
            },
            "required": ["camera", "agent", "entities", "events", "ui_state"],
            "propertyOrdering": ["camera", "agent", "entities", "events", "ui_state"],
        },
    },
    "required": [
        "camera",
        "agent",
        "entities",
        "events",
        "physics",
        "affordances",
        "ui_state",
        "reward_signal",
        "scene_caption",
        "uncertainty",
    ],
    "propertyOrdering": [
        "scene_caption",
        "camera",
        "agent",
        "entities",
        "events",
        "physics",
        "affordances",
        "ui_state",
        "reward_signal",
        "uncertainty",
    ],
}

NARRATIVE_SEGMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "label": {"type": "string"},
        "reason": {"type": "string"},
        "pacing": {"type": "string", "enum": enum_values(Pacing)},
        "narrative_role": {"type": "string", "enum": enum_values(NarrativeRole)},
        "shareability": {"type": "integer", "minimum": 0, "maximum": 100},
        "emotional_valence": {"type": "string", "enum": enum_values(EmotionalValence)},
        "spoiler_risk": {"type": "integer", "minimum": 0, "maximum": 100},
        "protected_chain": {"type": "boolean"},
    },
    "required": [
        "score",
        "label",
        "reason",
        "pacing",
        "narrative_role",
        "shareability",
        "emotional_valence",
        "spoiler_risk",
        "protected_chain",
    ],
    "propertyOrdering": [
        "score",
        "label",
        "pacing",
        "narrative_role",
        "shareability",
        "emotional_valence",
        "spoiler_risk",
        "protected_chain",
        "reason",
    ],
}

EPISODE_IDENTIFY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "game_title": {"type": "string"},
        "genre": {"type": "string", "enum": enum_values(Genre)},
        "perspective": {"type": "string", "enum": enum_values(Perspective)},
        "contains_real_world_video": {"type": "boolean"},
        "notes": {"type": "string"},
    },
    "required": ["game_title", "genre", "perspective", "contains_real_world_video"],
    "propertyOrdering": [
        "game_title",
        "genre",
        "perspective",
        "contains_real_world_video",
        "notes",
    ],
}


# --------------------------------------------------------------------------
# Flattening for columnar export
# --------------------------------------------------------------------------

# Column order is part of the export contract; downstream loaders read by name
# but a stable order keeps Parquet diffs and schema evolution legible.
DENSE_WINDOW_COLUMNS: list[str] = [
    "episode_id",
    "window_id",
    "window_index",
    "t_start",
    "t_end",
    "camera_perspective",
    "camera_motion",
    "camera_motion_magnitude",
    "camera_shake",
    "camera_cut_detected",
    "agent_action_category",
    "agent_action",
    "agent_secondary_action",
    "agent_movement_mode",
    "agent_intent",
    "agent_control_confidence",
    "entity_count",
    "entity_roles",
    "primary_entity_role",
    "event_count",
    "event_types",
    "primary_event_type",
    "primary_event_outcome",
    "primary_event_magnitude",
    "has_causal_chain",
    "physics",
    "affordances",
    "ui_score",
    "ui_timer_seconds",
    "ui_lives",
    "ui_health_pct",
    "ui_currency",
    "ui_rank",
    "ui_players_remaining",
    "reward_signal",
    "scene_caption",
    "uncertainty_camera",
    "uncertainty_agent",
    "uncertainty_entities",
    "uncertainty_events",
    "uncertainty_ui_state",
    "telemetry_verified",
]


def flatten_window(
    window: DenseWindow, episode_id: str, window_index: int
) -> dict[str, Any]:
    """Flatten a DenseWindow into one columnar row.

    List-valued fields collapse to a count plus a pipe-joined string of values.
    Keeping both means a consumer can filter cheaply on the count and still
    recover the vocabulary without re-reading the nested JSONL.
    """
    events = window.events
    primary_event = max(events, key=lambda e: e.magnitude) if events else None
    entities = window.entities
    primary_entity = max(entities, key=lambda e: e.salience) if entities else None

    return {
        "episode_id": episode_id,
        "window_id": window.window_id,
        "window_index": window_index,
        "t_start": window.t_start,
        "t_end": window.t_end,
        "camera_perspective": window.camera.perspective.value,
        "camera_motion": window.camera.motion.value,
        "camera_motion_magnitude": window.camera.motion_magnitude,
        "camera_shake": window.camera.shake,
        "camera_cut_detected": window.camera.cut_detected,
        "agent_action_category": window.agent.action_category.value,
        "agent_action": window.agent.action.value,
        "agent_secondary_action": window.agent.secondary_action.value,
        "agent_movement_mode": window.agent.movement_mode.value,
        "agent_intent": window.agent.intent,
        "agent_control_confidence": window.agent.control_confidence,
        "entity_count": len(entities),
        "entity_roles": "|".join(sorted({e.role.value for e in entities})),
        "primary_entity_role": primary_entity.role.value if primary_entity else "",
        "event_count": len(events),
        "event_types": "|".join(sorted({e.event_type.value for e in events})),
        "primary_event_type": primary_event.event_type.value if primary_event else "",
        "primary_event_outcome": primary_event.outcome.value if primary_event else "",
        "primary_event_magnitude": primary_event.magnitude if primary_event else 0,
        "has_causal_chain": any(e.cause_event_id for e in events),
        "physics": "|".join(p.value for p in window.physics),
        "affordances": "|".join(window.affordances),
        "ui_score": window.ui_state.score,
        "ui_timer_seconds": window.ui_state.timer_seconds,
        "ui_lives": window.ui_state.lives,
        "ui_health_pct": window.ui_state.health_pct,
        "ui_currency": window.ui_state.currency,
        "ui_rank": window.ui_state.rank,
        "ui_players_remaining": window.ui_state.players_remaining,
        "reward_signal": window.reward_signal,
        "scene_caption": window.scene_caption,
        "uncertainty_camera": window.uncertainty.camera,
        "uncertainty_agent": window.uncertainty.agent,
        "uncertainty_entities": window.uncertainty.entities,
        "uncertainty_events": window.uncertainty.events,
        "uncertainty_ui_state": window.uncertainty.ui_state,
        "telemetry_verified": window.telemetry_verified,
    }


def parse_dense_window(
    payload: dict[str, Any],
    window_id: str,
    t_start: float,
    t_end: float,
) -> DenseWindow:
    """Build a DenseWindow from a raw model response.

    Structured output guarantees shape but not semantics, so unknown enum values
    and out-of-range numbers are coerced to defaults here rather than being
    allowed to fail a whole stream mid-annotation.
    """
    return DenseWindow(
        window_id=window_id,
        t_start=t_start,
        t_end=t_end,
        camera=CameraObservation(**_coerce_enums(payload.get("camera", {}), {
            "perspective": Perspective,
            "motion": CameraMotion,
        })),
        agent=AgentObservation(**_coerce_enums(payload.get("agent", {}), {
            "action_category": ActionCategory,
            "action": Action,
            "secondary_action": Action,
            "movement_mode": MovementMode,
        })),
        entities=[
            EntityObservation(**_coerce_enums(e, {"role": EntityRole}))
            for e in payload.get("entities", [])
        ],
        events=[
            AnnotatedEvent(**_coerce_enums(e, {"event_type": EventType, "outcome": Outcome}))
            for e in payload.get("events", [])
        ],
        physics=[
            PhysicsEvent(p) for p in payload.get("physics", []) if p in enum_values(PhysicsEvent)
        ],
        affordances=payload.get("affordances", []),
        ui_state=UIState(**payload.get("ui_state", {})),
        reward_signal=max(-1.0, min(1.0, float(payload.get("reward_signal", 0.0)))),
        scene_caption=payload.get("scene_caption", ""),
        uncertainty=Uncertainty(**payload.get("uncertainty", {})),
    )


def _coerce_enums(
    data: dict[str, Any], enum_fields: dict[str, type[Enum]]
) -> dict[str, Any]:
    """Drop enum-valued keys the model got wrong so pydantic defaults apply."""
    cleaned = dict(data)
    for field_name, enum_cls in enum_fields.items():
        value = cleaned.get(field_name)
        if value is not None and value not in enum_values(enum_cls):
            cleaned.pop(field_name, None)
    return cleaned
