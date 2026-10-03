import { loadCommandEnv, loadCreatorContext, parseLookupArgs } from "./commands";

async function main() {
  const env = loadCommandEnv();
  if (env.NODE_ENV === "production") {
    console.error("creator:approve is disabled in production.");
    process.exitCode = 1;
    return;
  }

  const lookup = parseLookupArgs(process.argv.slice(2));
  const { admin, user, profile } = await loadCreatorContext(env, lookup);
  if (!user) throw new Error("User not found.");
  if (!profile) throw new Error("Creator profile not found. Complete Become a Creator in the app first.");

  console.log(`Current creator status: ${profile.status}`);
  if (profile.status === "ACTIVE") {
    console.log("Creator profile is already ACTIVE. No update was made.");
    return;
  }
  if (profile.status === "SUSPENDED") throw new Error("Creator profile is SUSPENDED and was not changed.");

  const { data: updated, error: updateError } = await admin.from("creator_profiles").update({ status: "ACTIVE" }).eq("id", profile.id).eq("user_id", user.id).select("id,status").single();
  if (updateError || !updated) throw new Error("Creator status update failed.");

  const { error: auditError } = await admin.from("security_audit_log").insert({ user_id: user.id, action: "CREATOR_APPROVED", actor_type: "DEVELOPMENT_TOOL", reason_code: "DEV_CREATOR_APPROVAL" });
  if (auditError) throw new Error("Creator was activated, but the audit record could not be written.");
  console.log(`Creator approved: ${profile.id}`);
  console.log(`Status: ${profile.status} -> ${updated.status}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Creator approval failed.");
  process.exitCode = 1;
});
