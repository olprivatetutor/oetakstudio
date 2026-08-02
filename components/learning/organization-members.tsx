"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Copy, Loader2, MailPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrganizationRole } from "@/types/domain";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: OrganizationRole;
  status: string;
};

type Invitation = {
  id: string;
  email: string;
  role: OrganizationRole;
  status: string;
  expiresAt: string;
};

type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

const assignableRoles = ["admin", "content", "teacher", "learner", "guardian"] as const;

export function OrganizationMembers({ organizationId }: { organizationId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [role, setRole] = useState<(typeof assignableRoles)[number]>("learner");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch(`/api/v1/organizations/${organizationId}/members`);
    const result = (await response.json()) as ApiResponse<{ members: Member[]; invitations: Invitation[] }>;
    if (result.success) {
      setMembers(result.data.members);
      setInvitations(result.data.invitations);
      setError("");
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsLoading(true);
    setError("");
    const response = await fetch(`/api/v1/organizations/${organizationId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(form.get("email")), role }),
    });
    const result = (await response.json()) as ApiResponse<{ inviteUrl: string }>;
    if (!result.success) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    setInviteUrl(result.data.inviteUrl);
    event.currentTarget.reset();
    await load();
    toast.success("Invitation created");
  }

  async function updateRole(userId: string, nextRole: OrganizationRole) {
    const response = await fetch(`/api/v1/organizations/${organizationId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    const result = (await response.json()) as ApiResponse<Member>;
    if (!result.success) return setError(result.error.message);
    await load();
  }

  async function remove(userId: string) {
    const response = await fetch(`/api/v1/organizations/${organizationId}/members/${userId}`, {
      method: "DELETE",
    });
    const result = (await response.json()) as ApiResponse<Member>;
    if (!result.success) return setError(result.error.message);
    await load();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div className="space-y-2"><Label htmlFor={`invite-${organizationId}`}>Email</Label><Input id={`invite-${organizationId}`} name="email" type="email" required /></div>
        <div className="space-y-2"><Label>Role</Label><Select value={role} onValueChange={(value: typeof role) => setRole(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{assignableRoles.map((value) => <SelectItem key={value} value={value}>{value.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
        <Button type="submit" disabled={isLoading}><MailPlus className="h-4 w-4" />Invite</Button>
      </form>

      {inviteUrl && <div className="flex items-center gap-2"><Input value={inviteUrl} readOnly aria-label="Invitation URL" /><Button type="button" size="icon" variant="outline" title="Copy invitation URL" onClick={async () => { await navigator.clipboard.writeText(inviteUrl); toast.success("Invitation URL copied"); }}><Copy className="h-4 w-4" /><span className="sr-only">Copy invitation URL</span></Button></div>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {isLoading && members.length === 0 ? <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /><span className="sr-only">Loading members</span></div> : (
        <Table>
          <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Role</TableHead><TableHead className="w-12"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {members.map((member) => <TableRow key={member.userId}><TableCell><div className="font-medium">{member.name}</div><div className="text-xs text-muted-foreground">{member.email}</div></TableCell><TableCell>{member.role === "owner" ? "owner" : <Select value={member.role} onValueChange={(value: OrganizationRole) => void updateRole(member.userId, value)}><SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger><SelectContent>{assignableRoles.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}</TableCell><TableCell>{member.role !== "owner" && <Button type="button" size="icon" variant="ghost" title="Remove member" onClick={() => void remove(member.userId)}><Trash2 className="h-4 w-4" /><span className="sr-only">Remove {member.name}</span></Button>}</TableCell></TableRow>)}
          </TableBody>
        </Table>
      )}

      {invitations.length > 0 && <div className="space-y-2"><h3 className="text-sm font-semibold">Pending invitations</h3>{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm"><span>{invitation.email}</span><span className="text-muted-foreground">{invitation.role} · {new Date(invitation.expiresAt).toLocaleDateString()}</span></div>)}</div>}
    </div>
  );
}
