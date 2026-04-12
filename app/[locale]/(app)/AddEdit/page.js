"use client";
import React from 'react';
import AddEdit from './AddEdit';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/app/components/AppContext';
import { formStore } from '@/app/stores/formStore';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import { usePageTitle } from '@/app/hooks/usePageTitle';

function AddEditPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const appContext = useAppContext();
  const { campaignId, clientId, stores } = appContext;
  
  const formType = searchParams.get('formType') || 'donor';
  const mode = searchParams.get('mode') || 'add';
  
  const getPageTitle = () => {
    if (mode === 'edit') {
      return formType === 'donor' ? 'עריכת תורם' : 'עריכת מתרים';
    }
    return formType === 'donor' ? 'הוספת תורם חדש' : 'הוספת מתרים חדש';
  };
  
  usePageTitle(getPageTitle());
  const personId = searchParams.get('personId');
  const fundraiserId = searchParams.get('fundraiserId');

  useEffect(() => {
    const initializeForm = async () => {
      if (mode === 'add') {
        formStore.openAddForm(formType);
      } else if (mode === 'edit' && personId) {
        const itemData = { person_id: personId };
        await formStore.openEditForm(itemData, formType);
      }
    };

    initializeForm();
  }, [formType, mode, personId]);

  const handleClose = () => {
    formStore.closeForm();
    if (formType === 'fundraiser') {
      router.push('/fundRaisers');
    } else {
      router.push('/donors');
    }
  };

  const handleSubmit = async (data) => {
    if (!campaignId || !clientId) {
      console.error('Missing campaignId or clientId');
      return null;
    }

    const result = await formStore.submitForm(clientId, campaignId, data);
    
    if (result) {
      if (formType === 'fundraiser') {
        await stores.fundraisersStore?.fetchFundraisers();
      } else {
        await stores.donorsStore?.fetchDonors();
      }
    }
    
    return result;
  };

  return (
    <AddEdit
      isOpen={true} 
      onClose={handleClose}
      onSubmit={handleSubmit}
    />
  );
}

export default observer(AddEditPage); 