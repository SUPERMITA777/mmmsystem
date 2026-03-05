"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const params = useParams();
    const tenantSlug = params?.tenant as string || "mmm";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al iniciar sesión");
                return;
            }

            router.push(`/${tenantSlug}/admin`);
            router.refresh();
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
                fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                padding: "1rem",
            }}
        >
            {/* Animated background orbs */}
            <div
                style={{
                    position: "fixed",
                    top: "-20%",
                    left: "-10%",
                    width: "500px",
                    height: "500px",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
                    animation: "float 8s ease-in-out infinite",
                    pointerEvents: "none",
                }}
            />
            <div
                style={{
                    position: "fixed",
                    bottom: "-20%",
                    right: "-10%",
                    width: "600px",
                    height: "600px",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)",
                    animation: "float 10s ease-in-out infinite reverse",
                    pointerEvents: "none",
                }}
            />

            <div
                style={{
                    width: "100%",
                    maxWidth: "420px",
                    background: "rgba(255, 255, 255, 0.05)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    borderRadius: "24px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    padding: "3rem 2.5rem",
                    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05) inset",
                    position: "relative",
                    zIndex: 1,
                }}
            >
                {/* Logo / Brand */}
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <div
                        style={{
                            width: "64px",
                            height: "64px",
                            margin: "0 auto 1rem",
                            borderRadius: "16px",
                            background: "linear-gradient(135deg, #6366f1, #a855f7)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            boxShadow: "0 8px 24px rgba(99, 102, 241, 0.4)",
                        }}
                    >
                        🔒
                    </div>
                    <h1
                        style={{
                            color: "#fff",
                            fontSize: "1.75rem",
                            fontWeight: 700,
                            margin: 0,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        MMM System
                    </h1>
                    <p
                        style={{
                            color: "rgba(255, 255, 255, 0.5)",
                            fontSize: "0.875rem",
                            marginTop: "0.5rem",
                        }}
                    >
                        Ingresa tus credenciales para acceder
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Email Field */}
                    <div style={{ marginBottom: "1.25rem" }}>
                        <label
                            htmlFor="email"
                            style={{
                                display: "block",
                                color: "rgba(255, 255, 255, 0.7)",
                                fontSize: "0.8rem",
                                fontWeight: 500,
                                marginBottom: "0.5rem",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@mmmsystem.com"
                            required
                            style={{
                                width: "100%",
                                padding: "0.875rem 1rem",
                                borderRadius: "12px",
                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                background: "rgba(255, 255, 255, 0.06)",
                                color: "#fff",
                                fontSize: "0.95rem",
                                outline: "none",
                                transition: "all 0.2s ease",
                                boxSizing: "border-box",
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.6)";
                                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.15)";
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                        />
                    </div>

                    {/* Password Field */}
                    <div style={{ marginBottom: "1.5rem" }}>
                        <label
                            htmlFor="password"
                            style={{
                                display: "block",
                                color: "rgba(255, 255, 255, 0.7)",
                                fontSize: "0.8rem",
                                fontWeight: 500,
                                marginBottom: "0.5rem",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Contraseña
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={{
                                width: "100%",
                                padding: "0.875rem 1rem",
                                borderRadius: "12px",
                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                background: "rgba(255, 255, 255, 0.06)",
                                color: "#fff",
                                fontSize: "0.95rem",
                                outline: "none",
                                transition: "all 0.2s ease",
                                boxSizing: "border-box",
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.6)";
                                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.15)";
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div
                            style={{
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: "10px",
                                padding: "0.75rem 1rem",
                                marginBottom: "1.25rem",
                                color: "#fca5a5",
                                fontSize: "0.85rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                            }}
                        >
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: "100%",
                            padding: "0.875rem",
                            borderRadius: "12px",
                            border: "none",
                            background: loading
                                ? "rgba(99, 102, 241, 0.4)"
                                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            color: "#fff",
                            fontSize: "1rem",
                            fontWeight: 600,
                            cursor: loading ? "not-allowed" : "pointer",
                            transition: "all 0.2s ease",
                            boxShadow: loading ? "none" : "0 4px 16px rgba(99, 102, 241, 0.4)",
                            letterSpacing: "0.01em",
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = "translateY(-1px)";
                                e.currentTarget.style.boxShadow = "0 6px 20px rgba(99, 102, 241, 0.5)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = loading ? "none" : "0 4px 16px rgba(99, 102, 241, 0.4)";
                        }}
                    >
                        {loading ? (
                            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                <span
                                    style={{
                                        width: "18px",
                                        height: "18px",
                                        border: "2px solid rgba(255,255,255,0.3)",
                                        borderTopColor: "#fff",
                                        borderRadius: "50%",
                                        display: "inline-block",
                                        animation: "spin 0.6s linear infinite",
                                    }}
                                />
                                Ingresando...
                            </span>
                        ) : (
                            "Iniciar Sesión"
                        )}
                    </button>
                </form>

                <p
                    style={{
                        textAlign: "center",
                        color: "rgba(255, 255, 255, 0.3)",
                        fontSize: "0.75rem",
                        marginTop: "2rem",
                        marginBottom: 0,
                    }}
                >
                    MMM System Delivery © 2026
                </p>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-30px) rotate(3deg); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                input::placeholder {
                    color: rgba(255, 255, 255, 0.25);
                }
            `}</style>
        </div>
    );
}
