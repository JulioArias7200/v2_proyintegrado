# sma_unified/db/cosmos_client.py

from pymongo import MongoClient
from pymongo.errors import OperationFailure
from typing import Dict, Any, Optional
import os
from dotenv import load_dotenv
import json

load_dotenv()

class CosmosDBClient:
    """Cliente para Azure Cosmos DB / MongoDB Atlas compatible"""
    
    def __init__(self):
        self.uri = os.getenv("MONGO_URI")
        self.db_name = os.getenv("MONGO_DB", "sma_congreso")
        self.client = None
        self.db = None
        self._conectar()
    
    def _conectar(self):
        """Establecer conexión con MongoDB / Cosmos DB"""
        if not self.uri:
            raise ValueError("MONGO_URI no configurado en .env")
        
        self.client = MongoClient(self.uri, serverSelectionTimeoutMS=10000)
        self.db = self.client[self.db_name]
    
    def crear_colecciones(self):
        """Crear todas las colecciones necesarias con validación e índices"""
        
        colecciones = {
            # 1. AGENT_MESSAGES - Mensajes de agentes
            "agent_messages": {
                "indexes": [
                    [("id_proyecto", 1), ("timestamp", -1)],
                    [("nombre_agente", 1)],
                    [("timestamp", 1)],
                    [("estado", 1)]
                ]
            },
            
            # 2. PROYECTO_SNAPSHOTS - Snapshots de proyectos
            "proyecto_snapshots": {
                "indexes": [
                    [("id_proyecto", 1), ("created_at", -1)],
                    [("version", 1)]
                ]
            },
            
            # 3. EVENT_LOG - Log de eventos
            "event_log": {
                "indexes": [
                    [("proyecto_id", 1), ("timestamp", -1)],
                    [("event_type", 1)],
                    [("timestamp", 1)]
                ]
            },
            
            # 4. AGENT_EXECUTIONS - Ejecuciones de agentes
            "agent_executions": {
                "indexes": [
                    [("id_proyecto", 1), ("timestamp_inicio", -1)],
                    [("nombre_agente", 1)],
                    [("estado", 1)]
                ]
            },
            
            # 5. WORKFLOW_INSTANCES - Instancias de workflows
            "workflow_instances": {
                "indexes": [
                    [("id_proyecto", 1)],
                    [("workflow_name", 1)],
                    [("status", 1)]
                ]
            },
            
            # 6. AGENT_CONVERSATIONS - Conversaciones de agentes
            "agent_conversations": {
                "indexes": [
                    [("id_proyecto", 1)],
                    [("conversation_id", 1)],
                    [("created_at", 1)]
                ]
            },
            
            # 7. ANALYTICS_AGENTES - Métricas de agentes
            "analytics_agentes": {
                "indexes": [
                    [("nombre_agente", 1)],
                    [("periodo", 1)]
                ]
            }
        }
        
        existing = self.db.list_collection_names()
        for collection_name, config in colecciones.items():
            try:
                if collection_name not in existing:
                    self.db.create_collection(collection_name)
                    print(f"Colección '{collection_name}' creada.")
                else:
                    print(f"Colección '{collection_name}' ya existe.")
                
                # Crear índices
                col = self.db[collection_name]
                for index_spec in config.get("indexes", []):
                    try:
                        col.create_index(index_spec)
                    except Exception as ie:
                        print(f"Aviso en índice {index_spec} de {collection_name}: {ie}")
            except Exception as e:
                print(f"Error en colección '{collection_name}': {e}")
    
    def get_collection(self, nombre: str):
        """Obtener una colección"""
        return self.db[nombre]

    def log_event(self, proyecto_id: str, event_type: str, data: Dict = None, source: str = "crewai", severity: str = "INFO"):
        """Registrar evento en MongoDB"""
        from datetime import datetime
        col = self.get_collection("event_log")
        return col.insert_one({
            "proyecto_id": str(proyecto_id),
            "event_type": event_type,
            "data": data or {},
            "source": source,
            "severity": severity,
            "timestamp": datetime.utcnow()
        })

    def log_agent_execution(self, id_proyecto: str, nombre_agente: str, input_data: Dict, output_data: Dict, estado: str = "EXITO", tiempo_ms: int = 0):
        """Registrar ejecución de agente en MongoDB"""
        from datetime import datetime
        col = self.get_collection("agent_executions")
        return col.insert_one({
            "id_proyecto": str(id_proyecto),
            "nombre_agente": nombre_agente,
            "input_data": input_data or {},
            "output_data": output_data or {},
            "estado": estado,
            "tiempo_ms": tiempo_ms,
            "timestamp_inicio": datetime.utcnow(),
            "timestamp_fin": datetime.utcnow()
        })
    
    def close(self):
        """Cerrar conexión"""
        if self.client:
            self.client.close()

def setup_cosmos_completo():
    """Setup completo de colecciones MongoDB"""
    print("Iniciando configuración de colecciones MongoDB...")
    client = CosmosDBClient()
    try:
        client.crear_colecciones()
        print("Setup de colecciones MongoDB completado con éxito.")
        for col_name in client.db.list_collection_names():
            cnt = client.db[col_name].count_documents({})
            print(f" - {col_name}: {cnt} documentos")
    finally:
        client.close()

if __name__ == "__main__":
    setup_cosmos_completo()
