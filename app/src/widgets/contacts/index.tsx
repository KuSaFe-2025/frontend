import { FormControl, FormErrorMessage } from '@chakra-ui/form-control';
import { Heading } from '@chakra-ui/react';
import { useFormik } from 'formik';

import { Toaster, toaster } from '@/components/ui/toaster';
import { ContactsFormSchema, api } from '@/shared/lib';
import { MyButton, MyInput, MyTextarea } from '@/shared/ui';

import styles from './Contacts.module.scss';

export const Contacts = () => {
  const formik = useFormik({
    initialValues: {
      name: '',
      email: '',
      message: '',
    },

    validationSchema: ContactsFormSchema,

    onSubmit: async (values, actions) => {
      try {
        const requestValues = {
          userEmail: values.email,
          name: values.name,
          text: values.message,
        };

        await api.post('send-email', requestValues);

        toaster.create({
          title: 'Сообщение отправлено!',
          description: 'Я свяжусь с вами в ближайшее время.',
          type: 'success',
          closable: true,
        });

        actions.resetForm();
      } catch (error) {
        console.error('Send email error:', error);

        toaster.create({
          title: 'Ошибка!',
          description: 'Не удалось отправить сообщение. Попробуйте позже.',
          type: 'error',
          closable: true,
        });
      }
    },
  });

  return (
    <div className={styles.contactsContainer}>
      <Heading as="h1" size="4xl">
        Связаться со мной
      </Heading>

      <form className={styles.formContainer} onSubmit={formik.handleSubmit}>
        <FormControl
          className={styles.formFieldContainer}
          isInvalid={formik.touched.name && !!formik.errors.name}
        >
          <MyInput
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            placeholder="Как вас зовут?"
            variant="outline"
            maxLength={30}
          />
          <FormErrorMessage className={styles.formErrorMessage}>
            {formik.errors.name}
          </FormErrorMessage>
        </FormControl>

        <FormControl
          className={styles.formFieldContainer}
          isInvalid={formik.touched.email && !!formik.errors.email}
        >
          <MyInput
            name="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            placeholder="E-Mail"
            variant="outline"
            maxLength={100}
          />
          <FormErrorMessage className={styles.formErrorMessage}>
            {formik.errors.email}
          </FormErrorMessage>
        </FormControl>

        <FormControl
          className={styles.formFieldContainer}
          isInvalid={formik.touched.message && !!formik.errors.message}
        >
          <MyTextarea
            name="message"
            value={formik.values.message}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            placeholder="Сообщение"
            minHeight={20}
            maxLength={1000}
            variant="outline"
          />
          <FormErrorMessage className={styles.formErrorMessage}>
            {formik.errors.message}
          </FormErrorMessage>
        </FormControl>

        <MyButton className={styles.submitButton} type="submit">
          Отправить сообщение
        </MyButton>
      </form>
      <Toaster />
    </div>
  );
};
