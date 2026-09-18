"""Governance–Planning–Management water-system module."""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd


OBJECTIVE_COLS = ["J_economic", "J_social", "J_environment", "J_risk"]


@dataclass
class GovernanceConfig:
    vcrit: float = 180.0
    # 25 keeps the educational default feasible; users can raise it to 30+
    # to demonstrate how Governance can eliminate the entire decision set.
    qeco: float = 25.0
    w_econ: float = 0.25
    w_soc: float = 0.30
    w_env: float = 0.30
    w_risk: float = 0.15
    periods: int = 36
    v0: float = 320.0
    q0: float = 35.0

    def normalized_weights(self):
        raw = np.array([self.w_econ, self.w_soc, self.w_env, self.w_risk], dtype=float)
        return np.ones(4) / 4 if np.isclose(raw.sum(), 0) else raw / raw.sum()


def config_from_mapping(mapping) -> GovernanceConfig:
    defaults = GovernanceConfig()

    def number(name, fallback, cast=float):
        value = mapping.get(name, fallback)
        return cast(fallback) if value in (None, "") else cast(value)

    config = GovernanceConfig(
        vcrit=number("vcrit", defaults.vcrit), qeco=number("qeco", defaults.qeco),
        w_econ=number("w_econ", defaults.w_econ), w_soc=number("w_soc", defaults.w_soc),
        w_env=number("w_env", defaults.w_env), w_risk=number("w_risk", defaults.w_risk),
        periods=number("periods", defaults.periods, int), v0=number("v0", defaults.v0),
        q0=number("q0", defaults.q0),
    )
    if not 12 <= config.periods <= 60:
        raise ValueError("Số bước thời gian phải nằm trong khoảng 12–60.")
    if config.v0 < 0 or config.q0 < 0 or config.vcrit < 0 or config.qeco < 0:
        raise ValueError("Điều kiện và ràng buộc không được âm.")
    if any(value < 0 or value > 1 for value in (config.w_econ, config.w_soc, config.w_env, config.w_risk)):
        raise ValueError("Trọng số Governance phải nằm trong khoảng 0–1.")
    return config


def simulate_system(T, K, release_bias, supply_fraction, V0, Q0, Vcrit, Qeco, seed=42):
    rng = np.random.default_rng(seed)
    t = np.arange(T)
    seasonal = 0.5 + 0.5 * np.sin(2 * np.pi * (t - 3) / 12.0)
    inflow = np.maximum(38 + 28 * seasonal + rng.normal(0, 4.0, T), 5)
    demand = np.maximum(32 + 10 * (1 - seasonal) + rng.normal(0, 2.0, T), 10)
    V = np.zeros(T + 1)
    Q = np.zeros(T + 1)
    V[0] = min(V0, K)
    Q[0] = Q0
    release = np.zeros(T)
    supply = np.zeros(T)
    shortage = np.zeros(T)
    env_deficit = np.zeros(T)

    for k in range(T):
        storage_ratio = V[k] / max(K, 1e-9)
        adaptive_factor = np.clip(0.35 + 0.90 * storage_ratio, 0.25, 1.20)
        release[k] = max(0.0, release_bias * adaptive_factor)
        requested_supply = demand[k] * supply_fraction
        available = max(0.0, V[k] + inflow[k] - release[k])
        supply[k] = min(requested_supply, available)
        shortage[k] = max(0.0, demand[k] - supply[k])
        V[k + 1] = np.clip(V[k] + inflow[k] - release[k] - supply[k], 0.0, K)
        Q[k + 1] = 0.70 * Q[k] + 0.30 * release[k]
        env_deficit[k] = max(0.0, Qeco - Q[k + 1])

    states = pd.DataFrame({"t": np.arange(T + 1), "V": V, "Q": Q})
    controls = pd.DataFrame({
        "t": np.arange(T), "Inflow": inflow, "Demand": demand,
        "Release": release, "Supply": supply, "Shortage": shortage,
        "EnvDeficit": env_deficit,
    })
    objectives = {
        "J_economic": float(0.18 * K + 0.8 * np.sum(release) + 0.5 * np.sum(supply)),
        "J_social": float(np.sum(shortage)),
        "J_environment": float(np.sum(env_deficit)),
        "J_risk": float(np.mean(V[1:] < Vcrit)),
    }
    return states, controls, objectives


def pareto_mask(values):
    values = np.asarray(values, dtype=float)
    result = np.ones(len(values), dtype=bool)
    for i in range(len(values)):
        dominated = np.all(values <= values[i], axis=1) & np.any(values < values[i], axis=1)
        dominated[i] = False
        if np.any(dominated):
            result[i] = False
    return result


def _records_for(config):
    records = []
    trajectories = {}
    candidate_id = 0
    for K in np.array([350, 450, 550, 650, 750], dtype=float):
        if K < max(config.vcrit + 30, config.v0 * 0.75):
            continue
        for release_bias in np.array([18, 24, 30, 36, 42, 48], dtype=float):
            for supply_fraction in np.array([0.70, 0.80, 0.90, 1.00], dtype=float):
                states, controls, objectives = simulate_system(
                    config.periods, K, release_bias, supply_fraction,
                    config.v0, config.q0, config.vcrit, config.qeco,
                )
                storage_reliability = float(np.mean(states["V"].iloc[1:] >= config.vcrit))
                env_reliability = float(np.mean(states["Q"].iloc[1:] >= config.qeco))
                records.append({
                    "id": candidate_id, "K": K, "release_bias": release_bias,
                    "supply_fraction": supply_fraction,
                    "storage_reliability": storage_reliability,
                    "env_reliability": env_reliability,
                    "feasible": storage_reliability >= 0.80 and env_reliability >= 0.60,
                    **objectives,
                })
                trajectories[candidate_id] = (states, controls)
                candidate_id += 1
    return pd.DataFrame(records), trajectories


def _json_records(frame):
    return frame.replace({np.nan: None}).to_dict(orient="records")


def run_governance(config: GovernanceConfig | None = None):
    config = config or GovernanceConfig()
    df, trajectories = _records_for(config)
    feasible_df = df[df["feasible"]].copy()
    base = {
        "config": asdict(config), "weights": [float(x) for x in config.normalized_weights()],
        "feasible_count": int(len(feasible_df)), "candidate_count": int(len(df)),
    }
    if feasible_df.empty:
        return {**base, "error": "Không có phương án nào thỏa ràng buộc Governance hiện tại."}

    feasible_df["pareto"] = pareto_mask(feasible_df[OBJECTIVE_COLS].to_numpy())
    pareto_df = feasible_df[feasible_df["pareto"]].copy()
    for col in OBJECTIVE_COLS:
        lo, hi = feasible_df[col].min(), feasible_df[col].max()
        pareto_df[f"{col}_norm"] = 0.0 if np.isclose(lo, hi) else (pareto_df[col] - lo) / (hi - lo)
    norm_cols = [f"{col}_norm" for col in OBJECTIVE_COLS]
    pareto_df["GovernanceScore"] = pareto_df[norm_cols].to_numpy() @ config.normalized_weights()
    selected = pareto_df.loc[pareto_df["GovernanceScore"].idxmin()]
    selected_id = int(selected["id"])
    selected_states, selected_controls = trajectories[selected_id]

    def native(value):
        if isinstance(value, (np.integer, int)):
            return int(value)
        if isinstance(value, (np.floating, float)):
            return float(value)
        return value

    return {
        **base,
        "selected": {key: native(value) for key, value in selected.to_dict().items()},
        "selected_id": selected_id,
        "states": _json_records(selected_states), "controls": _json_records(selected_controls),
        "candidates": _json_records(df),
        "feasible": _json_records(feasible_df), "pareto": _json_records(pareto_df),
    }
