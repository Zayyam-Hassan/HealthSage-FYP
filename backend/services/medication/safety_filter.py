"""
Neo4j safety checks: contraindications, drug-drug interactions, medication vs condition conflicts.
If Neo4j is not configured, returns safe with no flags.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)

NEO4J_URI = os.getenv("NEO4J_URI", "")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")


def _get_driver():
    """Lazy Neo4j driver. Returns None if not configured."""
    if not NEO4J_URI or not NEO4J_PASSWORD:
        return None
    try:
        from neo4j import GraphDatabase
        return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    except ImportError:
        logger.warning("neo4j package not installed; safety checks disabled")
        return None
    except Exception as e:
        logger.warning("Neo4j driver init failed: %s", e)
        return None


def _check_contraindications(driver, drug_name: str, conditions: List[str]) -> List[str]:
    """Return list of flag messages if drug is contraindicated in any patient condition."""
    if not conditions:
        return []
    flags = []
    try:
        with driver.session() as session:
            for cond in conditions:
                r = session.run(
                    """
                    MATCH (m:Medication)-[:CONTRAINDICATED_IN]->(c:Condition)
                    WHERE toLower(m.name) CONTAINS toLower($drug) AND toLower(c.name) CONTAINS toLower($cond)
                    RETURN m.name as med
                    """,
                    drug=drug_name,
                    cond=cond,
                )
                if r.single():
                    flags.append(f"Possible contraindication: {drug_name} with condition {cond}")
    except Exception as e:
        logger.warning("Neo4j contraindication check failed: %s", e)
    return flags


def _check_interactions(driver, drug_name: str, current_meds: List[str]) -> List[str]:
    """Return list of flag messages if drug interacts with any current medication."""
    if not current_meds:
        return []
    flags = []
    try:
        with driver.session() as session:
            for med in current_meds:
                r = session.run(
                    """
                    MATCH (a:Medication)-[:INTERACTS_WITH]-(b:Medication)
                    WHERE (toLower(a.name) CONTAINS toLower($d1) AND toLower(b.name) CONTAINS toLower($d2))
                       OR (toLower(a.name) CONTAINS toLower($d2) AND toLower(b.name) CONTAINS toLower($d1))
                    RETURN a.name, b.name
                    LIMIT 1
                    """,
                    d1=drug_name,
                    d2=med,
                )
                if r.single():
                    flags.append(f"Possible interaction: {drug_name} with {med}")
    except Exception as e:
        logger.warning("Neo4j interaction check failed: %s", e)
    return flags


def check_medication_safety(context: Dict[str, Any], recommendations: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check primary option and alternatives for contraindications and drug-drug interactions.
    Assumes graph: (:Medication)-[:INTERACTS_WITH]->(:Medication), (:Medication)-[:CONTRAINDICATED_IN]->(:Condition).
    Returns:
      { "safe_primary": bool, "primary_flags": [...], "alternative_flags": [{"drug_name": str, "flags": [...]}] }
    """
    result: Dict[str, Any] = {
        "safe_primary": True,
        "primary_flags": [],
        "alternative_flags": [],
    }
    driver = _get_driver()
    if not driver:
        return result

    conditions = context.get("conditions") or []
    current_meds = context.get("current_medications") or []

    try:
        primary = recommendations.get("primary_option") or {}
        drug = primary.get("drug_name") or ""
        if drug:
            flags = _check_contraindications(driver, drug, conditions) + _check_interactions(driver, drug, current_meds)
            result["primary_flags"] = flags
            result["safe_primary"] = len(flags) == 0

        alts = recommendations.get("alternatives") or []
        for alt in alts:
            name = alt.get("drug_name") or ""
            if not name:
                continue
            flags = _check_contraindications(driver, name, conditions) + _check_interactions(driver, name, current_meds)
            result["alternative_flags"].append({"drug_name": name, "flags": flags})
    finally:
        try:
            driver.close()
        except Exception:
            pass

    return result
