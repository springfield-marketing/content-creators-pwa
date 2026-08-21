import { Badge } from "@mantine/core";
import { STATUS_LABEL, type PermitStatus } from "@/lib/registry/permit-status";

const COLOR: Record<PermitStatus, string> = {
  active: "green",
  expiring: "orange",
  expired: "red",
  none: "gray",
};

/**
 * `label` overrides the wording without changing the colour, for people who
 * are shown availability rather than a permit lifecycle — an agent sees
 * "Available", not "Expiring soon".
 */
export function StatusBadge({
  status,
  label,
}: {
  status: PermitStatus;
  label?: string;
}) {
  return (
    <Badge color={COLOR[status]} variant="light" size="sm">
      {label ?? STATUS_LABEL[status]}
    </Badge>
  );
}
