"use server"
import { error } from 'console';
import {signIn} from '@/auth'
import {z} from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import {redirect} from 'next/navigation' 


const InvoiceSchema = z.object({
    id: z.string(),
    customerId: z.string({
       invalid_type_error:'Please select a customer.',
    }),
    amount: z.coerce.number().gt(0,{message:"Please enter an amount greater than $0"}),
    status: z.enum(['pending','paid'],{
         invalid_type_error:'Please select an invoice status.'
    }),
    date: z.string()
})

export async function authenticate(
    prevState: string | undefined,
    formData : FormData
){
    try{
          await signIn('credentials',Object.fromEntries(formData))
    }catch(error){
            if((error as Error).message.includes('CredentialsSignin')){
                 return 'CredentialsSignin';
            }
             throw error;
    }
}



const CreateInvoice = InvoiceSchema.omit({ id: true, date: true });

// this is temporary untill @types/react-dom is updated
export type State = {
    errors?:{
        customerId?:string[];
        amount?: String[];
        status?:string[]
    };
    message?:string|null;
}

//function to create Invoice
export async function createInvoice(prevState:State,formData:FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId:formData.get('customerId'),
        amount:formData.get('amount'),
        status:formData.get('status')
    })
   
    // if form validation fails, return errors early ,otherwise,continue
    
    if(!validatedFields.success){
        return{
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. failed to Create Invoice. ',
        }
    }
    //prepare data for insertion into database
    const {customerId , amount , status} = validatedFields.data;
    //storing amount in cents
    const amountInCents = amount * 100;
    //creating new dates 'YYYY-MM-DD'
    const date  =  new Date().toISOString().split('T')[0]
    try{
        await sql `
          INSERT INTO invoices (customer_id, amount , status ,date)
          VALUES (${customerId},${amountInCents} ,${status},${date})
        `
    }catch(error){
         return {
             message:'Database Error : Failed to create Invoice'
         }
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}


// function to edit or update the invoices
const UpdateInvoice = InvoiceSchema.omit({ id: true, date: true });

export async function updateInvoice(
    id:string ,
    prevState:State,
    formData:FormData,
    
    ){
      
        const validatedFields = UpdateInvoice.safeParse({
            customerId:formData.get('customerId'),
            amount:formData.get('amount'),
            status:formData.get('status')
        })

    if(!validatedFields.success){
        return{
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice'
        }
    }

    const { customerId ,amount , status} = validatedFields.data
    const amountInCents = amount * 100;
    try{
        await sql`
         UPDATE invoices
         SET customer_id = ${customerId}, amount = ${amountInCents} , status = ${status}
         WHERE id= ${id}
      `
    }catch(error){
        return {
            message:'Database Error : Failed to Update Invoice'
        }
    }
   
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices'); 

}

//delete invoice
export async function deleteInvoice(id:string){
           //  throw new Error('Failed to Delete Invoice');
    try{
        await sql `DELETE FROM invoices WHERE id = ${id}`
       
    }catch(error){
        return{
            message:'Database Error : Failed to Delete Invoice'
        }
    }
     
}