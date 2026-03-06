import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-bold tracking-tight">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">
          Seite nicht gefunden
        </p>
        <Button asChild>
          <Link to="/">Zur Startseite</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
