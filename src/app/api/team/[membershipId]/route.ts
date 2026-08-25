import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { updateProfile } from "@/lib/domain/boards";
import { accessLevelSchema, parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({
  fullName: z.string().optional(),
  workRole: z.string().optional(),
  accessLevel: accessLevelSchema.optional(),
  status: z.enum(["ACTIVE", "INVITED", "DISABLED"]).optional(),
  capacityPoints: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  try {
    const { membershipId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const profile = await updateProfile(context, { membershipId, ...input });
    return apiSuccess({ profile });
  } catch (error) {
    return apiFailure(error);
  }
}

