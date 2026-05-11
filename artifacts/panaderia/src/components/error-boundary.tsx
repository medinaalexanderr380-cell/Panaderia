import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive opacity-70" />
          <div>
            <p className="font-semibold text-lg">Ocurrió un error en esta sección</p>
            <p className="text-sm text-muted-foreground mt-1">{this.state.message}</p>
          </div>
          <Button onClick={() => { this.setState({ hasError: false, message: "" }); window.location.href = "/"; }}>
            Volver al inicio
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
