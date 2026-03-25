"""
Quick helper to sample patients from the populated HealthSage knowledge graph.

Run from the repo root:

    python scripts/inspect_ontology.py

It will:
  - Load output/healthsage_abox.ttl
  - For each dataset (dataset1..dataset4), print up to 5 patients that
    have at least one observation from that dataset, including patientId,
    age, and sex.
"""

from rdflib import Graph, Namespace
from rdflib.namespace import RDF


HS = Namespace("http://healthsage.org/ontology#")


def print_sample_patients(g: Graph, dataset_name: str, n: int = 5) -> None:
    query = f"""
    PREFIX hs: <http://healthsage.org/ontology#>

    SELECT DISTINCT ?patient ?pid ?age ?sex
    WHERE {{
      ?patient a hs:Patient ;
               hs:patientId ?pid .
      OPTIONAL {{ ?patient hs:age ?age . }}
      OPTIONAL {{ ?patient hs:sex ?sex . }}
      ?patient hs:hasObservation ?obs .
      ?obs hs:sourceId "{dataset_name}" .
    }}
    LIMIT {n}
    """
    print(f"\n=== {dataset_name} ===")
    for row in g.query(query):
        pid = str(row.pid)
        age = str(row.age) if row.age is not None else "NA"
        sex = str(row.sex) if row.sex is not None else "NA"
        print(f"patientId={pid}, age={age}, sex={sex}")


def main() -> None:
    g = Graph()
    g.parse("output/healthsage_abox.ttl", format="turtle")

    for ds in ["dataset1", "dataset2", "dataset3", "dataset4"]:
        print_sample_patients(g, ds, n=5)


if __name__ == "__main__":
    main()

