import { FOOD_API_TIMEOUT_MS, FOOD_API_URL } from './config';

/**
 * Cliente para interactuar con la API de comida
 */
export class FoodApiClient {
    private baseUrl: string;
    private timeout: number;

    constructor(baseUrl: string = FOOD_API_URL, timeout: number = FOOD_API_TIMEOUT_MS) {
        this.baseUrl = baseUrl;
        this.timeout = timeout;
    }

    /**
     * Agrega comida al sistema
     * @param cantidad - Cantidad de comida a agregar
     * @returns Promise con la respuesta del servidor
     */
    async addFood(cantidad: number): Promise<any> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.baseUrl}/api/food/add/${cantidad}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`Error al agregar comida: ${response.status} ${response.statusText}`);
                console.error('Data:', errorData);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    console.error(`Error: Timeout después de ${this.timeout}ms`);
                } else {
                    console.error(`Error al agregar comida: ${error.message}`);
                }
            } else {
                console.error('Error desconocido:', error);
            }
            throw error;
        }
    }

    /**
     * Cambia la URL base del cliente
     * @param newBaseUrl - Nueva URL base
     */
    setBaseUrl(newBaseUrl: string): void {
        this.baseUrl = newBaseUrl;
    }

    /**
     * Obtiene la URL base actual
     * @returns URL base configurada
     */
    getBaseUrl(): string {
        return this.baseUrl;
    }

    /**
     * Cambia el timeout de las peticiones
     * @param newTimeout - Nuevo timeout en milisegundos
     */
    setTimeout(newTimeout: number): void {
        this.timeout = newTimeout;
    }
}
