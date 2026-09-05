# sma_unified/agents/base_agent.py

from typing import Dict, Any, Optional, List
import yaml
import os
import json
from crewai import Agent

class BaseAgenteLegislativo:
    """Clase base para la inicialización y orquestación de agentes legislativos CrewAI"""
    
    def __init__(self, config_path: str = None):
        if not config_path:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(base_dir, "config", "agents.yaml")
        
        self.config_path = config_path
        self.config = self._cargar_config()
        self._agentes_cache = {}
    
    def _cargar_config(self) -> Dict:
        """Cargar configuración desde YAML"""
        if not os.path.exists(self.config_path):
            return {"agentes": {}}
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {"agentes": {}}
    
    def get_config(self, nombre_agente: str) -> Dict:
        """Obtener configuración de un agente desde el bloque 'agentes' o raíz"""
        agentes = self.config.get('agentes', {})
        if nombre_agente in agentes:
            return agentes[nombre_agente]
        if nombre_agente in self.config:
            return self.config[nombre_agente]
        aliases = {
            'Concentrador': 'agente_concentrador_observaciones',
            'agente_concentrador_observaciones': 'Concentrador',
            'Veto_Promulgacion': 'agente_veto_promulgacion',
            'agente_veto_promulgacion': 'Veto_Promulgacion',
        }
        alt = aliases.get(nombre_agente)
        if alt:
            if alt in agentes:
                return agentes[alt]
            if alt in self.config:
                return self.config[alt]
        return {}
    
    def crear_agente(self, nombre_agente: str) -> Agent:
        """Crear una instancia de Agent CrewAI desde configuración YAML"""
        if nombre_agente in self._agentes_cache:
            return self._agentes_cache[nombre_agente]
        
        cfg = self.get_config(nombre_agente)
        role = cfg.get('rol') or cfg.get('role', f"Agente {nombre_agente}")
        goal = cfg.get('objetivo') or cfg.get('goal', f"Ejecutar tareas de {nombre_agente}")
        backstory = cfg.get('backstory', f"Especialista parlamentario en {nombre_agente}")
        allow_delegation = cfg.get('allow_delegation', False)
        
        agent = Agent(
            role=role,
            goal=goal,
            backstory=backstory,
            verbose=False,
            allow_delegation=allow_delegation
        )
        
        self._agentes_cache[nombre_agente] = agent
        return agent
    
    def listar_agentes(self) -> List[str]:
        """Listar todos los agentes disponibles en la configuración"""
        agentes = self.config.get('agentes', {})
        return list(agentes.keys())

_base_instance = None

def get_base_agent() -> BaseAgenteLegislativo:
    global _base_instance
    if _base_instance is None:
        _base_instance = BaseAgenteLegislativo()
    return _base_instance
