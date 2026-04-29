/**
 * Pipeline column configuration types
 */

export interface CustomPipelineColumn {
  id: string;
  name: string;
  position: number;
  config: {
    color?: string;
    wipLimit?: number;
    description?: string;
  };
  is_active: boolean;
}

export interface PipelineColumnConfig {
  columns: CustomPipelineColumn[];
  updatedAt: string;
}
