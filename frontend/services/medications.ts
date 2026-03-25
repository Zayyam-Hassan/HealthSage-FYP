/**
 * Medications API service — wired to backend /api/v1/mongo/medications (catalog)
 */
import { apiClient } from './api';

export interface Medication {
  id: string;
  medication_id: string;
  name: string;
  brand_name?: string;
  description?: string;
  side_effects: string[];
  warnings: string[];
  how_to_use?: string;
  neo4j_medication_uri?: string;
  neo4j_node_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface BackendMedicationDoc {
  id?: string;
  _id?: string;
  medication_id?: string;
  name: string;
  brand_name?: string;
  description?: string;
  side_effects?: string[];
  warnings?: string[];
  how_to_use?: string;
  created_at?: string;
  updated_at?: string;
}

function mapDoc(d: BackendMedicationDoc): Medication {
  const id = (d.id ?? d._id ?? '').toString();
  return {
    id,
    medication_id: d.medication_id ?? id,
    name: d.name,
    brand_name: d.brand_name,
    description: d.description,
    side_effects: Array.isArray(d.side_effects) ? d.side_effects : [],
    warnings: Array.isArray(d.warnings) ? d.warnings : [],
    how_to_use: d.how_to_use,
    created_at: d.created_at ?? new Date().toISOString(),
    updated_at: d.updated_at ?? new Date().toISOString(),
  };
}

const BASE = '/mongo/medications';

class MedicationsService {
  async getMedications(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Medication>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    const query = queryParams.toString();
    const response = await apiClient.get<{ items: BackendMedicationDoc[]; total: number; page: number; limit: number; pages: number }>(
      `${BASE}?${query}`
    );
    return {
      items: (response.items ?? []).map(mapDoc),
      total: response.total ?? 0,
      page: response.page ?? 1,
      limit: response.limit ?? 20,
      pages: response.pages ?? 0,
    };
  }

  async getMedication(medicationId: string): Promise<Medication> {
    const doc = await apiClient.get<BackendMedicationDoc>(`${BASE}/${medicationId}`);
    return mapDoc(doc);
  }
}

export const medicationsService = new MedicationsService();
