import { supabase } from "./supabaseClient";

// A small reusable price book (see schema.sql) — saved once, picked from a
// list on the Material step instead of retyping the same plank/tile/roll
// specs on every job.

export async function listSavedMaterials() {
  const { data, error } = await supabase
    .from("saved_materials")
    .select("id, name, material_type, length, width, pack_size, price_per_pack, roll_width")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createSavedMaterial(material) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("saved_materials")
    .insert({ user_id: user.id, ...material })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteSavedMaterial(id) {
  const { error } = await supabase.from("saved_materials").delete().eq("id", id);
  if (error) throw error;
}
