import { supabase } from '../lib/supabase';

export type Plan = {
  id: string;
  nombre: string;
  descripcion: string | null;
  veces_por_semana: number | null;
  precio: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanInsert = Omit<Plan, 'id' | 'created_at' | 'updated_at'>;

const planService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('planes')
      .select('*')
      .order('precio', { ascending: true });

    if (error) throw new Error(error.message);
    return data as Plan[];
  },

  getAllActivos: async () => {
    const { data, error } = await supabase
      .from('planes')
      .select('*')
      .eq('activo', true)
      .order('precio', { ascending: true });

    if (error) throw new Error(error.message);
    return data as Plan[];
  },

  create: async (plan: PlanInsert) => {
    const { data, error } = await supabase
      .from('planes')
      .insert(plan)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Plan;
  },

  update: async (id: string, updates: Partial<PlanInsert>) => {
    const { data, error } = await supabase
      .from('planes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Plan;
  },

  desactivar: async (id: string) => {
    const { data, error } = await supabase
      .from('planes')
      .update({ activo: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Plan;
  },

  activar: async (id: string) => {
    const { data, error } = await supabase
      .from('planes')
      .update({ activo: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Plan;
  },
};

export default planService; // 👈 EXPORT DEFAULT