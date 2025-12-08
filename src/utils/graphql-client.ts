import { API_KEY, getApiUrl } from './api-config';
import { onError } from '@apollo/client/link/error';
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';

// Create an error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

// Create the HTTP link with the proper headers (no proxy)
const httpLink = new HttpLink({
  uri: getApiUrl(), // Direct URL (not proxied)
  headers: {
    'x-api-key': API_KEY,
    'x-organization-id': '67fe35f25e42152fb5185a5e', // Change if dynamic
  },
});

// Initialize Apollo Client
export const client = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
});

/**
 * Simple GraphQL client for making API calls
 */
export async function graphqlRequest<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const url = getApiUrl();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-organization-id': '67fe35f25e42152fb5185a5e', // Change if dynamic
        Origin: window.location.origin,
      },
      mode: 'cors',
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! Status: ${response.status}, Details: ${errorText}`
      );
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors.map((e: any) => e.message).join('\n'));
    }

    return data.data as T;
  } catch (error) {
    console.error('GraphQL request failed:', error);
    throw error;
  }
}

/**
 * Fetch centers
 */
export async function fetchCenters<T = any>(): Promise<T> {
  const query = `
    query Centers {
      centers {
        _id
        name
        phone
        location
        seqNo
        address {
          street
          city
          state
          country
          zip
        }
        organization {
          _id
          logo
          gstNumber
          panNumber
          brandName
          companyName
          socialLinks
        }
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Search users by name, type, and center
 */
export async function searchUsers<T = any>(
  userType: string,
  centerId: string[],
  search?: string
): Promise<T> {
  const query = `
    query Users($userType: UserType, $centerId: [ObjectID!]!, $search: String) {
      users(userType: $userType, centerId: $centerId, search: $search) {
        _id
        profileData {
          ... on Patient {
            firstName
            lastName
          }
        }
      }
    }
  `;

  return graphqlRequest(query, {
    userType,
    centerId,
    search,
  });
}

/**
 * Search users with pagination - temporary function to avoid caching issues
 */
export async function searchUsersWithPagination<T = any>(
  userType: string,
  centerId: string[],
  search?: string
): Promise<T> {
  const query = `
    query Users(
      $userType: UserType!
      $centerId: [ObjectID!]!
      $search: String
      $filter: UserFilterInput
      $pagination: CursorPaginationInput
      $sort: UserSortInput
    ) {
      users(
        userType: $userType
        centerId: $centerId
        search: $search
        filter: $filter
        pagination: $pagination
        sort: $sort
      ) {
        data {
          _id
          seqNo
          phone
          email
          isActive
          userType
          profileData {
            ... on Patient {
              firstName
              lastName
              dob
              bio
              gender
              profilePicture
              status
              category
              cohort
              patientType
              __typename
            }
            __typename
          }
          __typename
        }
        pagination {
          nextCursor
          prevCursor
          hasNext
          hasPrevious
          limit
          __typename
        }
        __typename
      }
    }
  `;

  const variables = {
    userType,
    centerId,
    search: search || null,
    filter: null,
    pagination: {
      limit: 200,
      direction: 'FORWARD',
    },
    sort: {
      field: 'CREATED_AT',
      order: 'DESC',
    },
  };

  return graphqlRequest(query, variables);
}

/**
 * Fetch appointments for a patient using Reports query
 */
export async function fetchAppointments<T = any>(
  patientId: string
): Promise<T> {
  // Ensure patientId is provided
  if (!patientId) {
    throw new Error('Patient ID is required');
  }

  const query = `
    query Reports($patientId: ObjectID!) {
      reports(patientId: $patientId) {
        _id
        appointment {
          _id
          seqNo
          event {
            startTime
            endTime
          }
        }
      }
    }
  `;

  return graphqlRequest(query, { patientId });
}

// Export everything for centralized access
export default {
  client,
  graphqlRequest,
  fetchCenters,
  searchUsers,
  searchUsersWithPagination,
  fetchAppointments,
};
