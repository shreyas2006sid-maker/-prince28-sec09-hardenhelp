import json
from pathlib import Path


def test_sample_records_have_twenty_unique_ids_and_sources() -> None:
    data_file = Path(__file__).parents[1] / "data" / "sample_records.json"
    records = json.loads(data_file.read_text(encoding="utf-8"))
    record_ids = [record["id"] for record in records]

    assert len(records) == 20
    assert len(record_ids) == len(set(record_ids))
    assert all(record.get("rule_id") for record in records)
    assert all(record.get("source_url", "").endswith(f"#{record['rule_id']}") for record in records)
