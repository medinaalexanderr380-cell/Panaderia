import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Key, UserX, Edit2, ShieldCheck, User, Lock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ADMIN_PASSWORD = "04052005";

interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  creadoEn: string;
}

function useUsuarios() {
  return useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: () => fetch("/api/usuarios", { credentials: "include" }).then(r => r.json()),
  });
}

const apiFetch = (url: string, opts: RequestInit) =>
  fetch(url, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts.headers || {}) } })
    .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });

function PantallaContrasena({ onAcceso }: { onAcceso: () => void }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const { toast } = useToast();

  const verificar = () => {
    if (pass === ADMIN_PASSWORD) {
      onAcceso();
    } else {
      setError(true);
      setPass("");
      toast({ title: "Contraseña incorrecta", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Acceso restringido</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Ingresá la contraseña de administrador para continuar</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Input
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={e => { setPass(e.target.value); setError(false); }}
            onKeyDown={e => e.key === "Enter" && verificar()}
            className={error ? "border-destructive focus-visible:ring-destructive" : ""}
            autoFocus
          />
          {error && <p className="text-destructive text-sm text-center">Contraseña incorrecta</p>}
          <Button className="w-full" onClick={verificar} disabled={!pass}>
            Ingresar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Usuarios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: usuarios, isLoading } = useUsuarios();

  const [acceso, setAcceso] = useState(false);

  const [dialogNuevo, setDialogNuevo] = useState(false);
  const [dialogEditar, setDialogEditar] = useState<Usuario | null>(null);
  const [dialogPassword, setDialogPassword] = useState<Usuario | null>(null);
  const [dialogDesactivar, setDialogDesactivar] = useState<Usuario | null>(null);
  const [dialogReiniciar, setDialogReiniciar] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const [form, setForm] = useState({ username: "", nombre: "", password: "", rol: "vendedor" });
  const [editForm, setEditForm] = useState({ nombre: "", rol: "vendedor", activo: true });
  const [nuevaPass, setNuevaPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");

  const crearMutation = useMutation({
    mutationFn: (data: typeof form) => apiFetch("/api/usuarios", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["usuarios"] }); toast({ title: "Usuario creado correctamente" }); setDialogNuevo(false); setForm({ username: "", nombre: "", password: "", rol: "vendedor" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const editarMutation = useMutation({
    mutationFn: (data: { id: number } & typeof editForm) => apiFetch(`/api/usuarios/${data.id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["usuarios"] }); toast({ title: "Usuario actualizado" }); setDialogEditar(null); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { id: number; password: string }) => apiFetch(`/api/usuarios/${data.id}/password`, { method: "PUT", body: JSON.stringify({ password: data.password }) }),
    onSuccess: () => { toast({ title: "Contraseña actualizada correctamente" }); setDialogPassword(null); setNuevaPass(""); setConfirmarPass(""); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const desactivarMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/usuarios/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["usuarios"] }); toast({ title: "Usuario desactivado" }); setDialogDesactivar(null); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const reiniciarMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/reiniciar", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "✅ Datos reiniciados", description: "Todos los datos fueron borrados. Podés empezar de cero." });
      setDialogReiniciar(false);
      setConfirmText("");
    },
    onError: (e: any) => toast({ title: "Error al reiniciar", description: e.message, variant: "destructive" }),
  });

  if (!acceso) {
    return <PantallaContrasena onAcceso={() => setAcceso(true)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="w-8 h-8 text-primary" /> Gestión de Usuarios
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAcceso(false)} className="text-xs gap-1 text-muted-foreground">
            <Lock className="w-3.5 h-3.5" /> Bloquear
          </Button>
          <Button onClick={() => { setForm({ username: "", nombre: "", password: "", rol: "vendedor" }); setDialogNuevo(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Zona de peligro */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Zona de peligro
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Reiniciar todos los datos</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Borra todas las ventas, compras, productos, proveedores, pérdidas y gastos. No se puede deshacer.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0 ml-4"
            onClick={() => { setConfirmText(""); setDialogReiniciar(true); }}
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Reiniciar datos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-base">Usuarios del sistema</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell></TableRow>
              ) : usuarios?.map(u => (
                <TableRow key={u.id} className={!u.activo ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-sm font-medium">{u.username}</TableCell>
                  <TableCell>{u.nombre}</TableCell>
                  <TableCell>
                    <Badge variant={u.rol === "admin" ? "default" : "secondary"} className="gap-1">
                      {u.rol === "admin" ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {u.rol === "admin" ? "Admin" : "Vendedor"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.activo ? "outline" : "destructive"} className={u.activo ? "text-green-600 border-green-300" : ""}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setEditForm({ nombre: u.nombre, rol: u.rol, activo: u.activo }); setDialogEditar(u); }}>
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-blue-600" onClick={() => { setNuevaPass(""); setConfirmarPass(""); setDialogPassword(u); }}>
                        <Key className="w-3.5 h-3.5" /> Contraseña
                      </Button>
                      {u.activo && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-destructive" onClick={() => setDialogDesactivar(u)}>
                          <UserX className="w-3.5 h-3.5" /> Desactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dialog: Nuevo */}
      <Dialog open={dialogNuevo} onOpenChange={setDialogNuevo}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-sm font-medium mb-1.5 block">Nombre completo</label>
              <Input placeholder="Ej: Juan García" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1.5 block">Usuario (para iniciar sesión)</label>
              <Input placeholder="Ej: juan" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))} /></div>
            <div><label className="text-sm font-medium mb-1.5 block">Contraseña</label>
              <Input type="password" placeholder="Mínimo 4 caracteres" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1.5 block">Rol</label>
              <Select value={form.rol} onValueChange={v => setForm(f => ({ ...f, rol: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNuevo(false)}>Cancelar</Button>
            <Button onClick={() => crearMutation.mutate(form)} disabled={crearMutation.isPending || !form.username || !form.nombre || !form.password}>
              {crearMutation.isPending ? "Creando..." : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar */}
      <Dialog open={!!dialogEditar} onOpenChange={o => !o && setDialogEditar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar — {dialogEditar?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-sm font-medium mb-1.5 block">Nombre completo</label>
              <Input value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1.5 block">Rol</label>
              <Select value={editForm.rol} onValueChange={v => setEditForm(f => ({ ...f, rol: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogEditar(null)}>Cancelar</Button>
            <Button onClick={() => dialogEditar && editarMutation.mutate({ id: dialogEditar.id, ...editForm })} disabled={editarMutation.isPending}>
              {editarMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Contraseña */}
      <Dialog open={!!dialogPassword} onOpenChange={o => !o && setDialogPassword(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cambiar Contraseña — {dialogPassword?.nombre}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-sm font-medium mb-1.5 block">Nueva contraseña</label>
              <Input type="password" placeholder="Nueva contraseña" value={nuevaPass} onChange={e => setNuevaPass(e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1.5 block">Confirmar contraseña</label>
              <Input type="password" placeholder="Repetí la contraseña" value={confirmarPass} onChange={e => setConfirmarPass(e.target.value)} /></div>
            {nuevaPass && confirmarPass && nuevaPass !== confirmarPass && (
              <p className="text-destructive text-sm">Las contraseñas no coinciden</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPassword(null)}>Cancelar</Button>
            <Button
              onClick={() => dialogPassword && passwordMutation.mutate({ id: dialogPassword.id, password: nuevaPass })}
              disabled={passwordMutation.isPending || nuevaPass.length < 4 || nuevaPass !== confirmarPass}
            >
              {passwordMutation.isPending ? "Guardando..." : "Cambiar Contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Desactivar */}
      <AlertDialog open={!!dialogDesactivar} onOpenChange={o => !o && setDialogDesactivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{dialogDesactivar?.nombre}</strong> no podrá confirmar acciones hasta que lo reactives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => dialogDesactivar && desactivarMutation.mutate(dialogDesactivar.id)}>
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Reiniciar todos los datos */}
      <Dialog open={dialogReiniciar} onOpenChange={o => { if (!o) { setDialogReiniciar(false); setConfirmText(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Reiniciar todos los datos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive space-y-1">
              <p className="font-semibold">⚠️ Esta acción no se puede deshacer.</p>
              <p>Se borrarán permanentemente:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 mt-1 text-destructive/80">
                <li>Todas las ventas e ítems de venta</li>
                <li>Todas las compras e ítems de compra</li>
                <li>Todos los productos y proveedores</li>
                <li>Todas las pérdidas y gastos</li>
              </ul>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Escribí <span className="font-mono font-bold text-destructive">REINICIAR</span> para confirmar
              </label>
              <Input
                placeholder="REINICIAR"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                className="font-mono"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogReiniciar(false); setConfirmText(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => reiniciarMutation.mutate()}
              disabled={confirmText !== "REINICIAR" || reiniciarMutation.isPending}
            >
              {reiniciarMutation.isPending ? "Reiniciando..." : "Sí, borrar todo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
