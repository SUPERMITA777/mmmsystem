
import dotenv from 'dotenv';
import path from 'path';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { processWhatsAppMessage } from '../lib/aiAgentService';

// Load env vars from root
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testAgent() {
    console.log("--- TESTING AGENT ---");
    console.log("GEMINI_API_KEY len:", process.env.GEMINI_API_KEY?.length);
    if (process.env.GEMINI_API_KEY) {
        console.log("GEMINI_API_KEY starts with:", process.env.GEMINI_API_KEY.substring(0, 5));
    }
    
    // Find sucursal ID for 'mmm'
    try {
        const { data: suc, error: sucError } = await supabaseAdmin
            .from('sucursales')
            .select('id')
            .eq('slug', 'mmm')
            .single();
            
        if (sucError || !suc) {
            console.error("Sucursal 'mmm' not found!", sucError);
            return;
        }
        
        const sucursalId = suc.id;
        console.log("Testing with sucursalId:", sucursalId);
        
        const result = await processWhatsAppMessage(
            sucursalId,
            'test_user_123',
            'Hola, ¿qué productos tenés?',
            false
        );
        console.log("RESULT:", JSON.stringify(result, null, 2));
    } catch (err: any) {
        console.error("TEST FAILED WITH CRITICAL ERROR:");
        console.error(err);
        if (err.stack) console.error(err.stack);
    }
}

testAgent();
