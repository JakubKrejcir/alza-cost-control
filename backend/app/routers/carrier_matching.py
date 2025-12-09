"""
Carrier Matching Helper
Poskytuje funkce pro matching dopravců podle name nebo alias
"""
from typing import Dict, Optional, List
from app.models import Carrier


def build_carrier_lookup(carriers: List[Carrier]) -> Dict[str, int]:
    """
    Vytvoří slovník pro rychlé vyhledávání dopravce podle name NEBO alias.
    
    Returns:
        Dict kde klíč je name nebo alias (lowercase) a hodnota je carrier_id
    """
    lookup = {}
    for c in carriers:
        # Přidej oficiální název
        if c.name:
            lookup[c.name.lower().strip()] = c.id
        # Přidej alias (pokud existuje)
        if c.alias:
            lookup[c.alias.lower().strip()] = c.id
    return lookup


def find_carrier_id(carrier_name: str, lookup: Dict[str, int]) -> Optional[int]:
    """
    Najde carrier_id podle jména (hledá v name i alias).
    
    Args:
        carrier_name: Název dopravce z Excel souboru
        lookup: Slovník vytvořený pomocí build_carrier_lookup
        
    Returns:
        carrier_id nebo None pokud nenalezeno
    """
    if not carrier_name:
        return None
    
    key = carrier_name.lower().strip()
    return lookup.get(key)


def normalize_carrier_name(name: str) -> str:
    """
    Normalizuje název dopravce pro porovnání.
    Odstraní právní formy a speciální znaky.
    """
    import re
    if not name:
        return ""
    
    name = name.lower().strip()
    
    # Odstraň právní formy
    for suffix in ['s.r.o.', 'sro', 'a.s.', 'as', 'spol.', 'spol', 'k.s.', 'v.o.s.']:
        name = name.replace(suffix, '')
    
    # Odstraň mezery a speciální znaky
    name = re.sub(r'[^a-z0-9áčďéěíňóřšťúůýž]', '', name)
    
    return name
