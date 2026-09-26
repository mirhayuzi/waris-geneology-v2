import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FamilyData, Person, Marriage, ParentChild, Collaborator, generateId } from "./types";

const STORAGE_KEY = "@waris_family_data";

const initialData: FamilyData = {
  persons: [],
  marriages: [],
  parentChildren: [],
  collaborators: [],
  rootPersonId: undefined,
  familyName: "My Family",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

type Action =
  | { type: "LOAD_DATA"; payload: FamilyData }
  | { type: "SET_FAMILY_NAME"; payload: string }
  | { type: "ADD_PERSON"; payload: Person }
  | { type: "UPDATE_PERSON"; payload: Person }
  | { type: "DELETE_PERSON"; payload: string }
  | { type: "ADD_MARRIAGE"; payload: Marriage }
  | { type: "DELETE_MARRIAGE"; payload: string }
  | { type: "ADD_PARENT_CHILD"; payload: ParentChild }
  | { type: "DELETE_PARENT_CHILD"; payload: string }
  | { type: "SET_ROOT_PERSON"; payload: string }
  | { type: "ADD_COLLABORATOR"; payload: Collaborator }
  | { type: "REMOVE_COLLABORATOR"; payload: string }
  | { type: "RESET_DATA" };

function reducer(state: FamilyData, action: Action): FamilyData {
  const now = new Date().toISOString();
  switch (action.type) {
    case "LOAD_DATA":
      return action.payload;
    case "SET_FAMILY_NAME":
      return { ...state, familyName: action.payload, updatedAt: now };
    case "ADD_PERSON":
      return { ...state, persons: [...state.persons, action.payload], updatedAt: now };
    case "UPDATE_PERSON":
      return {
        ...state,
        persons: state.persons.map((p) => (p.id === action.payload.id ? action.payload : p)),
        updatedAt: now,
      };
    case "DELETE_PERSON": {
      const pid = action.payload;
      return {
        ...state,
        persons: state.persons.filter((p) => p.id !== pid),
        marriages: state.marriages.filter((m) => m.husbandId !== pid && m.wifeId !== pid),
        parentChildren: state.parentChildren.filter((pc) => pc.parentId !== pid && pc.childId !== pid),
        rootPersonId: state.rootPersonId === pid ? undefined : state.rootPersonId,
        updatedAt: now,
      };
    }
    case "ADD_MARRIAGE":
      return { ...state, marriages: [...state.marriages, action.payload], updatedAt: now };
    case "DELETE_MARRIAGE":
      return { ...state, marriages: state.marriages.filter((m) => m.id !== action.payload), updatedAt: now };
    case "ADD_PARENT_CHILD":
      return { ...state, parentChildren: [...state.parentChildren, action.payload], updatedAt: now };
    case "DELETE_PARENT_CHILD":
      return { ...state, parentChildren: state.parentChildren.filter((pc) => pc.id !== action.payload), updatedAt: now };
    case "SET_ROOT_PERSON":
      return { ...state, rootPersonId: action.payload, updatedAt: now };
    case "ADD_COLLABORATOR":
      return { ...state, collaborators: [...state.collaborators, action.payload], updatedAt: now };
    case "REMOVE_COLLABORATOR":
      return { ...state, collaborators: state.collaborators.filter((c) => c.id !== action.payload), updatedAt: now };
    case "RESET_DATA":
      return { ...initialData, createdAt: now, updatedAt: now };
    default:
      return state;
  }
}

interface FamilyContextType {
  data: FamilyData;
  isLoading: boolean;
  addPerson: (person: Omit<Person, "id" | "createdAt" | "updatedAt">) => Person;
  updatePerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  addMarriage: (marriage: Omit<Marriage, "id">) => void;
  deleteMarriage: (id: string) => void;
  addParentChild: (pc: Omit<ParentChild, "id">) => void;
  deleteParentChild: (id: string) => void;
  setRootPerson: (id: string) => void;
  setFamilyName: (name: string) => void;
  addCollaborator: (collab: Omit<Collaborator, "id" | "invitedAt" | "status">) => void;
  removeCollaborator: (id: string) => void;
  getPersonById: (id: string) => Person | undefined;
  getChildren: (personId: string) => Person[];
  getParents: (personId: string) => Person[];
  getSpouses: (personId: string) => Person[];
  getSiblings: (personId: string) => Person[];
  resetData: () => void;
  /** Replaces the whole tree (used by restore) and saves it straight away. */
  replaceAllData: (data: FamilyData) => void;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [data, dispatch] = useReducer(reducer, initialData);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveData(data);
    }
  }, [data, isLoading]);

  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FamilyData;
        dispatch({ type: "LOAD_DATA", payload: parsed });
      }
    } catch (e) {
      console.error("Failed to load family data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = async (d: FamilyData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch (e) {
      console.error("Failed to save family data:", e);
    }
  };

  const addPerson = useCallback((personData: Omit<Person, "id" | "createdAt" | "updatedAt">): Person => {
    const now = new Date().toISOString();
    const person: Person = { ...personData, id: generateId(), createdAt: now, updatedAt: now };
    dispatch({ type: "ADD_PERSON", payload: person });
    return person;
  }, []);

  const updatePerson = useCallback((person: Person) => {
    dispatch({ type: "UPDATE_PERSON", payload: { ...person, updatedAt: new Date().toISOString() } });
  }, []);

  const deletePerson = useCallback((id: string) => {
    dispatch({ type: "DELETE_PERSON", payload: id });
  }, []);

  const addMarriage = useCallback((marriage: Omit<Marriage, "id">) => {
    dispatch({ type: "ADD_MARRIAGE", payload: { ...marriage, id: generateId() } });
  }, []);

  const deleteMarriage = useCallback((id: string) => {
    dispatch({ type: "DELETE_MARRIAGE", payload: id });
  }, []);

  const addParentChild = useCallback((pc: Omit<ParentChild, "id">) => {
    dispatch({ type: "ADD_PARENT_CHILD", payload: { ...pc, id: generateId() } });
  }, []);

  const deleteParentChild = useCallback((id: string) => {
    dispatch({ type: "DELETE_PARENT_CHILD", payload: id });
  }, []);

  const setRootPerson = useCallback((id: string) => {
    dispatch({ type: "SET_ROOT_PERSON", payload: id });
  }, []);

  const setFamilyName = useCallback((name: string) => {
    dispatch({ type: "SET_FAMILY_NAME", payload: name });
  }, []);

  const addCollaborator = useCallback((collab: Omit<Collaborator, "id" | "invitedAt" | "status">) => {
    dispatch({
      type: "ADD_COLLABORATOR",
      payload: { ...collab, id: generateId(), invitedAt: new Date().toISOString(), status: "pending" },
    });
  }, []);

  const removeCollaborator = useCallback((id: string) => {
    dispatch({ type: "REMOVE_COLLABORATOR", payload: id });
  }, []);

  const getPersonById = useCallback((id: string) => data.persons.find((p) => p.id === id), [data.persons]);

  const getChildren = useCallback(
    (personId: string) => {
      const childIds = data.parentChildren.filter((pc) => pc.parentId === personId).map((pc) => pc.childId);
      return data.persons.filter((p) => childIds.includes(p.id));
    },
    [data.persons, data.parentChildren]
  );

  const getParents = useCallback(
    (personId: string) => {
      const parentIds = data.parentChildren.filter((pc) => pc.childId === personId).map((pc) => pc.parentId);
      return data.persons.filter((p) => parentIds.includes(p.id));
    },
    [data.persons, data.parentChildren]
  );

  const getSpouses = useCallback(
    (personId: string) => {
      const spouseIds = data.marriages
        .filter((m) => m.husbandId === personId || m.wifeId === personId)
        .map((m) => (m.husbandId === personId ? m.wifeId : m.husbandId));
      return data.persons.filter((p) => spouseIds.includes(p.id));
    },
    [data.persons, data.marriages]
  );

  const getSiblings = useCallback(
    (personId: string) => {
      const parentIds = data.parentChildren.filter((pc) => pc.childId === personId).map((pc) => pc.parentId);
      if (parentIds.length === 0) return [];
      const siblingIds = data.parentChildren
        .filter((pc) => parentIds.includes(pc.parentId) && pc.childId !== personId)
        .map((pc) => pc.childId);
      const unique = [...new Set(siblingIds)];
      return data.persons.filter((p) => unique.includes(p.id));
    },
    [data.persons, data.parentChildren]
  );

  const resetData = useCallback(() => {
    dispatch({ type: "RESET_DATA" });
  }, []);

  const replaceAllData = useCallback((d: FamilyData) => {
    dispatch({ type: "LOAD_DATA", payload: { ...d, updatedAt: new Date().toISOString() } });
  }, []);

  return (
    <FamilyContext.Provider
      value={{
        data, isLoading, addPerson, updatePerson, deletePerson,
        addMarriage, deleteMarriage, addParentChild, deleteParentChild,
        setRootPerson, setFamilyName, addCollaborator, removeCollaborator,
        getPersonById, getChildren, getParents, getSpouses, getSiblings, resetData, replaceAllData,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within FamilyProvider");
  return ctx;
}
