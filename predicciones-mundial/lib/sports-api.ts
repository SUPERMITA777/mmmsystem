// Interfaz abstracta para la sincronización de partidos y resultados

export interface MatchData {
  id_externo: string;
  equipo_local: string;
  equipo_visitante: string;
  fecha_hora: string;
  estado: 'pendiente' | 'en_curso' | 'finalizado';
  resultado_local: number | null;
  resultado_visitante: number | null;
}

export interface ScheduleProvider {
  fetchUpcomingMatches(): Promise<MatchData[]>;
}

export interface ResultsProvider {
  fetchMatchResult(id_externo: string): Promise<Partial<MatchData>>;
}

// Ejemplo de implementación genérica (Mock)
export class ApiSportsProvider implements ScheduleProvider, ResultsProvider {
  private apiKey: string;
  private baseUrl = 'https://api.football-data.org/v4'; // O thesportsdb

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchUpcomingMatches(): Promise<MatchData[]> {
    // Implementar llamada real a la API
    // Ejemplo:
    // const res = await fetch(`${this.baseUrl}/competitions/WC/matches?status=SCHEDULED`, { headers: { 'X-Auth-Token': this.apiKey }});
    // const data = await res.json();
    // return data.matches.map(m => ...);
    return [];
  }

  async fetchMatchResult(id_externo: string): Promise<Partial<MatchData>> {
    // Implementar llamada real a la API
    // Ejemplo:
    // const res = await fetch(`${this.baseUrl}/matches/${id_externo}`, { headers: { 'X-Auth-Token': this.apiKey }});
    // const data = await res.json();
    // return { ... };
    return {};
  }
}
